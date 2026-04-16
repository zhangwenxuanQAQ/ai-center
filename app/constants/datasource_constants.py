"""
数据源常量定义

定义数据源类型枚举和配置参数字段
"""


class DatasourceType:
    """
    数据源类型枚举
    
    定义支持的数据源类型常量
    """
    MYSQL = "mysql"
    POSTGRESQL = "postgresql"
    ORACLE = "oracle"
    SQL_SERVER = "sql_server"
    S3 = "s3"
    MINIO = "minio"
    RUSTFS = "rustfs"


DATASOURCE_TYPE_LABELS = {
    DatasourceType.MYSQL: "MySQL",
    DatasourceType.POSTGRESQL: "PostgreSQL",
    DatasourceType.ORACLE: "Oracle",
    DatasourceType.SQL_SERVER: "SQL Server",
    DatasourceType.S3: "Amazon S3",
    DatasourceType.MINIO: "MinIO",
    DatasourceType.RUSTFS: "RustFS",
}

DATASOURCE_CATEGORY = {
    "relational_db": "关系型数据库",
    "file_storage": "文件存储服务",
}

DATASOURCE_TYPE_CATEGORY = {
    DatasourceType.MYSQL: "relational_db",
    DatasourceType.POSTGRESQL: "relational_db",
    DatasourceType.ORACLE: "relational_db",
    DatasourceType.SQL_SERVER: "relational_db",
    DatasourceType.S3: "file_storage",
    DatasourceType.MINIO: "file_storage",
    DatasourceType.RUSTFS: "file_storage",
}

DATASOURCE_CONFIG_FIELDS = {
    DatasourceType.MYSQL: [
        {"title": "主机地址", "name": "host", "type": "string", "description": "MySQL服务器地址，例如：localhost 或 192.168.1.1", "required": True},
        {"title": "端口", "name": "port", "type": "integer", "description": "MySQL服务器端口，默认3306", "required": True, "default_value": 3306},
        {"title": "数据库名", "name": "database", "type": "string", "description": "数据库名称，例如：test_db", "required": True},
        {"title": "用户名", "name": "username", "type": "string", "description": "数据库用户名，例如：root", "required": True},
        {"title": "密码", "name": "password", "type": "password", "description": "数据库密码", "required": True, "sensitive": True},
        {"title": "字符集", "name": "charset", "type": "string", "description": "字符集，默认utf8mb4", "required": False, "default_value": "utf8mb4"},
    ],
    DatasourceType.POSTGRESQL: [
        {"title": "主机地址", "name": "host", "type": "string", "description": "PostgreSQL服务器地址，例如：localhost 或 192.168.1.1", "required": True},
        {"title": "端口", "name": "port", "type": "integer", "description": "PostgreSQL服务器端口，默认5432", "required": True, "default_value": 5432},
        {"title": "数据库名", "name": "database", "type": "string", "description": "数据库名称，例如：test_db", "required": True},
        {"title": "用户名", "name": "username", "type": "string", "description": "数据库用户名，例如：postgres", "required": True},
        {"title": "密码", "name": "password", "type": "password", "description": "数据库密码", "required": True, "sensitive": True},
        {"title": "Schema", "name": "schema", "type": "string", "description": "Schema名称，默认public", "required": False, "default_value": "public"},
    ],
    DatasourceType.ORACLE: [
        {"title": "主机地址", "name": "host", "type": "string", "description": "Oracle服务器地址，例如：localhost 或 192.168.1.1", "required": True},
        {"title": "端口", "name": "port", "type": "integer", "description": "Oracle服务器端口，默认1521", "required": True, "default_value": 1521},
        {"title": "服务名", "name": "service_name", "type": "string", "description": "Oracle服务名，例如：ORCL", "required": True},
        {"title": "用户名", "name": "username", "type": "string", "description": "数据库用户名，例如：system", "required": True},
        {"title": "密码", "name": "password", "type": "password", "description": "数据库密码", "required": True, "sensitive": True},
    ],
    DatasourceType.SQL_SERVER: [
        {"title": "主机地址", "name": "host", "type": "string", "description": "SQL Server服务器地址，例如：localhost 或 192.168.1.1", "required": True},
        {"title": "端口", "name": "port", "type": "integer", "description": "SQL Server服务器端口，默认1433", "required": True, "default_value": 1433},
        {"title": "数据库名", "name": "database", "type": "string", "description": "数据库名称，例如：test_db", "required": True},
        {"title": "用户名", "name": "username", "type": "string", "description": "数据库用户名，例如：sa", "required": True},
        {"title": "密码", "name": "password", "type": "password", "description": "数据库密码", "required": True, "sensitive": True},
    ],
    DatasourceType.S3: [
        {"title": "Endpoint", "name": "endpoint_url", "type": "string", "description": "S3服务端点地址，需要带协议前缀，例如：https://s3.amazonaws.com", "required": True},
        {"title": "Access Key", "name": "access_key", "type": "string", "description": "访问密钥ID，例如：AKIAIOSFODNN7EXAMPLE", "required": True},
        {"title": "Secret Key", "name": "secret_key", "type": "password", "description": "访问密钥密码", "required": True, "sensitive": True},
        {"title": "Region", "name": "region", "type": "string", "description": "区域，默认us-east-1，例如：us-east-1", "required": False, "default_value": "us-east-1"},
        {"title": "Bucket", "name": "bucket", "type": "string", "description": "默认Bucket名称，例如：my-bucket", "required": False},
    ],
    DatasourceType.MINIO: [
        {"title": "Endpoint", "name": "endpoint_url", "type": "string", "description": "MinIO服务端点地址，需要带协议前缀，例如：http://localhost:9000", "required": True},
        {"title": "Access Key", "name": "access_key", "type": "string", "description": "访问密钥ID，例如：minioadmin", "required": True},
        {"title": "Secret Key", "name": "secret_key", "type": "password", "description": "访问密钥密码", "required": True, "sensitive": True},
        {"title": "Bucket", "name": "bucket", "type": "string", "description": "默认Bucket名称，例如：my-bucket", "required": False},
        {"title": "安全连接", "name": "secure", "type": "boolean", "description": "是否使用HTTPS，默认False", "required": False, "default_value": False},
    ],
    DatasourceType.RUSTFS: [
        {"title": "Endpoint", "name": "endpoint_url", "type": "string", "description": "RustFS服务端点地址，需要带协议前缀，例如：http://localhost:9000", "required": True},
        {"title": "Access Key", "name": "access_key", "type": "string", "description": "访问密钥ID，例如：rustfsadmin", "required": True},
        {"title": "Secret Key", "name": "secret_key", "type": "password", "description": "访问密钥密码", "required": True, "sensitive": True},
        {"title": "Bucket", "name": "bucket", "type": "string", "description": "默认Bucket名称，例如：my-bucket", "required": False},
        {"title": "安全连接", "name": "secure", "type": "boolean", "description": "是否使用HTTPS，默认False", "required": False, "default_value": False},
    ],
}
