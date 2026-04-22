#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
查找ffmpeg安装位置
"""

import os
import sys

# 常见的ffmpeg安装位置
common_locations = [
    r"C:\Program Files\ffmpeg\bin\ffmpeg.exe",
    r"C:\ffmpeg\bin\ffmpeg.exe",
    r"D:\ffmpeg\bin\ffmpeg.exe",
    r"E:\ffmpeg\bin\ffmpeg.exe",
    r"C:\Program Files (x86)\ffmpeg\bin\ffmpeg.exe",
    r"D:\Program Files\ffmpeg\bin\ffmpeg.exe",
    r"D:\anaconda\Library\bin\ffmpeg.exe",
    r"C:\Users\Admin\scoop\shims\ffmpeg.exe",
    r"C:\Users\Admin\AppData\Local\Programs\ffmpeg\bin\ffmpeg.exe",
]

print("正在查找ffmpeg...")
print("=" * 60)

found = False
for loc in common_locations:
    if os.path.exists(loc):
        print(f"✓ 找到ffmpeg: {loc}")
        found = True
        
        # 测试是否能运行
        try:
            import subprocess
            result = subprocess.run(
                [loc, '-version'],
                capture_output=True,
                text=True,
                timeout=10
            )
            if result.returncode == 0:
                print(f"  ✓ ffmpeg可用")
                version_line = result.stdout.split('\n')[0]
                print(f"  版本: {version_line}")
        except Exception as e:
            print(f"  ✗ 测试失败: {e}")
    else:
        print(f"  ✗ 未找到: {loc}")

print("\n" + "=" * 60)
if not found:
    print("未找到ffmpeg，请确认安装位置")
else:
    print("\n建议: 将ffmpeg的bin目录添加到系统环境变量PATH中")