import subprocess
import os

# 启动后端服务
def start_backend():
    print("Starting backend service...")
    # 切换到项目根目录
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    # 启动后端服务
    subprocess.run(["python", "app\server_run.py"])

if __name__ == "__main__":
    start_backend()