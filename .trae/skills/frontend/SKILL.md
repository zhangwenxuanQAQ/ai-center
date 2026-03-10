---
name: frontend
description: 前端代码开发时需要遵守如下规则
---

## 使用场景
- 构建前端web页面
- 调整页面样式以及布局
- 前端调用后端接口

## 技术栈
- React （开发框架）
- TypeScript （代码风格）
- Tailwind CSS 
- Antdesign （组件库）
- Zustand
- 其他有用的前端依赖

## 目录结构
```
web/  #主应用包
├── assets/              # 资产文件，放svg，icon等静态文件
├── pages/       # 功能页面
│   ├── page1/          # 具体页面
│         |── hooks/    #  具体页面的react hooks
│         |── less/    #  具体页面的样式
├── lib/             # Utilities and configurations
├── hooks/           # 通用react hooks
├── theme/           # 主题（控制夜间/白天模式）
├── utils/          # 工具类
├── services/        # 调用后端服务
├── locale/          # 不同语言翻译
├── README.md
├── CHANGELOG.md
```

## 代码要求：
1.所有前端页面代码必须使用TypeScript编写。 文件后缀为.ts
2.样式文件需要放在less文件夹下，每个页面的样式文件需要和页面文件夹同名。
3.文件名同意使用小写，单词之间使用-分隔。
4.严格按照上述技术栈进行实现
5.所有的删除按钮或者删除图标都需要添加确认弹窗，按钮颜色为红色。