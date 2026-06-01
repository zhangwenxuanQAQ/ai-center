1.后端启动文件是app/start_server.py
2.每次项目启动时都需要更新数据库表结构（不影响服务启动）
3.使用项目的.venv环境作为python的虚拟环境
4.后端启动命令为.venv\Scripts\python.exe -m app.start_server
5.需要启动mcp server
6.后端代码有更新时需要重启后端服务
7.当有python依赖更新时需要同时更新requirements,pyproject.toml,uv.lock
8.后端服务启动命令为.venv\Scripts\python.exe -m app.start_server 不要随意修改
9.ragflow源码地址在本机的F:\project\ragflow-0.22.1目录下