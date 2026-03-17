import urllib.request
import json

url = "http://localhost:8081/aicenter/v1/mcp/server"

try:
    req = urllib.request.Request(url, method='GET')
    with urllib.request.urlopen(req) as response:
        status_code = response.getcode()
        response_data = json.loads(response.read().decode('utf-8'))
        print(f"Status Code: {status_code}")
        print(f"Response: {json.dumps(response_data, indent=2, ensure_ascii=False)}")
except Exception as e:
    print(f"Error: {e}")