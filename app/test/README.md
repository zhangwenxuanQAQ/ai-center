# 测试和验证脚本

本目录包含用于验证和测试AI Center后端服务的脚本。

## 脚本说明

### 1. verify_imports.py
验证所有模块导入情况的脚本。

**功能：**
- 检查所有API模块、Services模块、DTO模块、Core模块和Database模块的导入情况
- 验证模块之间的依赖关系是否正确
- 输出详细的检查结果

**使用方法：**
```bash
python -m app.test.verify_imports
```

### 2. check_imports.py
检查目录下所有Python文件导入情况的脚本。

**功能：**
- 遍历指定目录下的所有Python文件
- 检查每个文件的导入情况
- 自动发现并检查所有模块

**使用方法：**
```bash
python -m app.test.check_imports
```

### 3. check_database.py
数据库连接和模型测试脚本。

**功能：**
- 测试数据库连接
- 检查表结构
- 测试数据的创建、查询和删除操作
- 验证模型定义是否正确

**使用方法：**
```bash
python -m app.test.check_database
```

## 注意事项

1. 运行测试脚本前，请确保数据库服务已启动
2. 测试脚本会创建和删除测试数据，请勿在生产环境运行
3. 所有测试脚本都应从项目根目录运行
