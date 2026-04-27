import urllib.request
import urllib.error
import json

url = "http://localhost:8081/aicenter/v1/mcp/server/3fcb0c93a795404b8aae7aaf26fff628/parse_swagger"
headers = {"Content-Type": "application/json"}
data = {"swagger_url": "http://localhost:8081/openapi.json"}
data_json = json.dumps(data).encode('utf-8')

try:
    req = urllib.request.Request(url, data=data_json, headers=headers, method='POST')
    with urllib.request.urlopen(req) as response:
        status_code = response.getcode()
        response_data = json.loads(response.read().decode('utf-8'))
        print(f"Status Code: {status_code}")
        print(f"Response: {json.dumps(response_data, indent=2, ensure_ascii=False)}")
except urllib.error.HTTPError as e:
    print(f"HTTP Error: {e.code} - {e.reason}")
    try:
        error_data = json.loads(e.read().decode('utf-8'))
        print(f"Error Response: {json.dumps(error_data, indent=2, ensure_ascii=False)}")
    except:
        pass
except Exception as e:
    print(f"Error: {e}")