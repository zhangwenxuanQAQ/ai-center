#!/usr/bin/env python3
"""
版本化镜像构建脚本
根据 modules_config.yaml 配置动态生成 Dockerfile，
仅包含当前版本启用模块所需的文件。

用法:
    python docker/versions/build.py --version full
    python docker/versions/build.py --version custom
    python docker/versions/build.py --config docker/versions/my-version/modules_config.yaml
    python docker/versions/build.py --version custom --no-build  # 仅生成 Dockerfile（输出到 stdout）
    python docker/versions/build.py --version custom --no-build -o Dockerfile.out  # 输出到指定文件
"""

import os
import sys
import re
import yaml
import argparse
import subprocess
from typing import Set, List


# 模块与需要复制的文件映射 (用于动态添加模块文件)
MODULE_FILES_MAP = {
    'knowledgebase': [
        'app/core/knowledgebase/rag/res/nltk_data',
        '9b5ad71b2ce5302211f9c61530b329a4922fc6a4',
    ],
}


def load_module_config(config_path: str) -> dict:
    """加载模块配置文件"""
    if not os.path.exists(config_path):
        print(f"[ERROR] 配置文件不存在: {config_path}")
        sys.exit(1)

    with open(config_path, 'r', encoding='utf-8') as f:
        config = yaml.safe_load(f)

    return config


def parse_module_dependencies(config: dict) -> Set[str]:
    """
    解析启用模块及所有传递依赖
    
    支持两种配置结构：
    1. 简单结构 (docker/versions/*/modules_config.yaml):
       enabled_modules: [...]
       modules: {...}  (可选)
    
    2. 完整结构 (configs/modules_config.yaml):
       version:
         enabled_modules: [...]
       modules: {...}
    
    Returns:
        最终启用的模块集合
    """
    # 尝试获取 enabled_modules
    # 可能在顶层，也可能在 version 下面
    enabled_modules_list = []
    if 'enabled_modules' in config:
        enabled_modules_list = config.get('enabled_modules', [])
    elif 'version' in config and isinstance(config.get('version'), dict):
        enabled_modules_list = config['version'].get('enabled_modules', [])

    # 获取模块定义
    module_defs = config.get('modules', {})

    enabled_modules = set(enabled_modules_list)

    if not enabled_modules:
        # 如果没有指定启用模块，启用所有模块
        print("[INFO] 未指定启用模块，启用所有模块")
        return set(module_defs.keys())

    # 如果没有模块定义（简单结构），直接返回启用的模块
    if not module_defs:
        print("[INFO] 未找到模块定义，直接使用配置中指定的模块")
        return enabled_modules

    # 解析传递依赖
    resolved = set(enabled_modules)
    changed = True

    while changed:
        changed = False
        current = set(resolved)

        for module_name in current:
            if module_name not in module_defs:
                print(f"[WARNING] 模块 {module_name} 未在定义中找到，跳过")
                continue

            module_def = module_defs[module_name]
            dependencies = module_def.get('dependencies', [])

            for dep in dependencies:
                if dep not in resolved:
                    resolved.add(dep)
                    changed = True
                    print(f"[INFO] 由于 {module_name} 依赖 {dep}，自动启用 {dep}")

    # 确保所有必需模块都被启用
    for name, mod_def in module_defs.items():
        if mod_def.get('required', False) and name not in resolved:
            print(f"[INFO] 自动启用地核心模块: {name}")
            resolved.add(name)
            for dep in mod_def.get('dependencies', []):
                if dep not in resolved:
                    resolved.add(dep)
                    print(f"[INFO] 由于 {name} 依赖 {dep}，自动启用 {dep}")

    return resolved


def process_dockerfile_template(
    template_path: str,
    enabled_modules: Set[str],
    output_path: str = None
) -> str:
    """
    根据启用的模块处理 Dockerfile 模板
    
    处理规则：
    - 标记为 # [MODULE:xxx:START] 和 # [MODULE:xxx:END] 之间的内容
    - 如果 xxx 模块未启用，则跳过这些内容（用注释标记）
    - 如果 xxx 模块已启用，则保留这些内容
    
    Args:
        template_path: 模板 Dockerfile 路径
        enabled_modules: 启用的模块集合
        output_path: 输出文件路径（可选，指定时才写文件）
    
    Returns:
        处理后的 Dockerfile 内容字符串
    """
    if not os.path.exists(template_path):
        print(f"[ERROR] 模板文件不存在: {template_path}")
        sys.exit(1)

    with open(template_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    # 识别模块标记并处理
    processed_lines = []
    skip_stack = []  # 当前需要跳过的模块栈

    for i, line in enumerate(lines):
        # 检查是否是 START 标记
        start_match = re.match(r'^# \[MODULE:(\w+):START\]\s*$', line)
        # 检查是否是 END 标记
        end_match = re.match(r'^# \[MODULE:(\w+):END\]\s*$', line)

        if start_match:
            module_name = start_match.group(1)
            if module_name not in enabled_modules:
                # 模块未启用，需要跳过后续内容
                skip_stack.append(module_name)
                processed_lines.append(f'# [SKIP] 模块 {module_name} 未启用\n')
                print(f"  [SKIP] 模块 {module_name} 未启用，跳过相关文件")
            else:
                print(f"  [INCLUDE] 模块 {module_name} 已启用，包含相关文件")
            continue

        if end_match:
            module_name = end_match.group(1)
            if skip_stack and skip_stack[-1] == module_name:
                skip_stack.pop()
            continue

        # 如果在跳过区间内，跳过该行
        if skip_stack:
            continue

        # 正常保留该行
        processed_lines.append(line)

    # 生成内容字符串
    content = ''.join(processed_lines)

    # 仅在指定了 output_path 时才写文件
    if output_path:
        os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"\n[SUCCESS] Dockerfile 已生成: {output_path}")

    return content


def build_image(
    dockerfile_content: str,
    image_tag: str,
    project_root: str,
    no_cache: bool = False
):
    """
    构建 Docker 镜像（通过 stdin 传递 Dockerfile 内容，不生成临时文件）
    
    Args:
        dockerfile_content: Dockerfile 内容字符串
        image_tag: 镜像标签
        project_root: 项目根目录
        no_cache: 是否不使用缓存
    """
    print(f"\n[BUILD] 开始构建镜像: {image_tag}")
    print(f"[BUILD] Dockerfile 内容已通过 stdin 传递")
    print(f"[BUILD] 项目根目录: {project_root}")

    cmd = [
        'docker', 'build',
        '-f', '-',  # 从 stdin 读取 Dockerfile
        '-t', image_tag,
    ]

    if no_cache:
        cmd.append('--no-cache')

    cmd.append(project_root)

    print(f"[BUILD] 执行命令: docker build -f - -t {image_tag} [context]")

    result = subprocess.run(
        cmd, cwd=project_root,
        input=dockerfile_content.encode('utf-8'),
        stdout=sys.stdout, stderr=sys.stderr
    )

    if result.returncode == 0:
        print(f"\n[SUCCESS] 镜像 {image_tag} 构建成功！")
    else:
        print(f"\n[ERROR] 镜像 {image_tag} 构建失败！")
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(
        description='构建 AI Center 版本化镜像',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
    # 构建满血版
    python docker/versions/build.py --version full

    # 构建自定义功能版
    python docker/versions/build.py --version custom

    # 使用自定义配置文件
    python docker/versions/build.py --config docker/versions/my-version/modules_config.yaml

    # 仅生成 Dockerfile（输出到 stdout，不生成文件）
    python docker/versions/build.py --version custom --no-build

    # 仅生成 Dockerfile 并保存到指定文件
    python docker/versions/build.py --version custom --no-build -o my.Dockerfile
        """
    )

    parser.add_argument(
        '--version', '-v',
        choices=['full', 'custom'],
        help='版本名称 (full/custom)'
    )

    parser.add_argument(
        '--config', '-c',
        help='自定义模块配置文件路径'
    )

    parser.add_argument(
        '--output', '-o',
        help='输出 Dockerfile 路径（仅 --no-build 时生效；构建时不生成任何文件）'
    )

    parser.add_argument(
        '--image-tag', '-t',
        help='Docker 镜像标签'
    )

    parser.add_argument(
        '--no-build',
        action='store_true',
        help='仅生成 Dockerfile，不构建镜像（输出到 stdout 或指定 --output）'
    )

    parser.add_argument(
        '--no-cache',
        action='store_true',
        help='不使用缓存构建镜像'
    )

    args = parser.parse_args()

    # 确定路径
    # __file__ = docker/versions/build.py
    # dirname(__file__) = docker/versions/
    # dirname(...) = docker/
    # dirname(...) = ai-center/ (项目根目录)
    project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

    # 确定配置文件路径
    if args.config:
        config_path = os.path.abspath(args.config)
    elif args.version:
        config_path = os.path.join(project_root, 'docker', 'versions', args.version, 'modules_config.yaml')
    else:
        parser.error("必须指定 --version 或 --config 参数")

    if not os.path.exists(config_path):
        print(f"[ERROR] 配置文件不存在: {config_path}")
        sys.exit(1)

    # 确定模板 Dockerfile 路径
    if args.version:
        template_path = os.path.join(project_root, 'docker', 'versions', args.version, 'Dockerfile')
    else:
        # 从配置文件路径推断模板
        config_dir = os.path.dirname(config_path)
        template_path = os.path.join(config_dir, 'Dockerfile')

    if not os.path.exists(template_path):
        print(f"[ERROR] Dockerfile 模板不存在: {template_path}")
        sys.exit(1)

    # 确定输出路径（仅在 --no-build 且指定了 --output 时写文件）
    output_path = None
    if args.no_build and args.output:
        output_path = os.path.abspath(args.output)

    # 加载配置
    print(f"\n[INFO] 加载配置文件: {config_path}")
    config = load_module_config(config_path)

    # 解析依赖关系
    print("\n[INFO] 解析模块依赖关系...")
    enabled_modules = parse_module_dependencies(config)

    print(f"\n[INFO] 启用的模块: {sorted(enabled_modules)}")

    # 处理 Dockerfile 模板（返回内容字符串，不生成临时文件）
    print("\n[INFO] 处理 Dockerfile 模板...")
    dockerfile_content = process_dockerfile_template(
        template_path=template_path,
        enabled_modules=enabled_modules,
        output_path=output_path  # 仅当 --no-build + --output 时有值
    )

    # 构建镜像
    if not args.no_build:
        # 正常构建：通过 stdin 传递 Dockerfile 内容，不生成任何文件
        image_tag = args.image_tag or f"aicenter:{args.version or 'custom'}"
        build_image(
            dockerfile_content=dockerfile_content,
            image_tag=image_tag,
            project_root=project_root,
            no_cache=args.no_cache
        )
    else:
        # 仅生成 Dockerfile
        if output_path:
            print(f"\n[INFO] Dockerfile 已保存到: {output_path}")
        else:
            print(f"\n[INFO] 已跳过镜像构建（--no-build）")
            print(f"[INFO] 以下为生成的 Dockerfile 内容：\n")
            print("=" * 60)
            print(dockerfile_content)
            print("=" * 60)
            print(f"\n[INFO] 提示：可通过以下命令手动构建：")
            print(f"      docker build -f - -t <image-tag> .  # 从 stdin 读取")
            print(f"      或指定输出文件后：docker build -f {args.output or '<output-path>'} -t <image-tag> .")


if __name__ == '__main__':
    main()