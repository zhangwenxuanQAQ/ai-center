import sys
sys.path.insert(0, '.')

from app.constants.knowledgebase_document_constants import (
    FileType, ChunkMethod,
    get_available_chunk_methods,
    get_default_chunk_method,
    validate_chunk_method,
    FILE_TYPE_CHUNK_METHODS,
    EXTENSION_CHUNK_METHODS
)

print("=" * 80)
print("文件类型对应的切片方法测试")
print("=" * 80)
print()

# 测试文件类型对应的切片方法
print("1. 文件类型对应的切片方法：")
for file_type, methods in FILE_TYPE_CHUNK_METHODS.items():
    print(f"  {file_type}:")
    for method in methods:
        print(f"    - {method}")
print()

# 测试后缀名对应的切片方法
print("2. 后缀名对应的切片方法：")
for ext, methods in EXTENSION_CHUNK_METHODS.items():
    print(f"  {ext}:")
    for method in methods:
        print(f"    - {method}")
print()

# 测试获取可用切片方法
print("3. 测试 get_available_chunk_methods:")
test_cases = [
    (FileType.PDF, "test.pdf"),
    (FileType.DOC, "test.doc"),
    (FileType.VISUAL, "test.jpg"),
    (FileType.AURAL, "test.mp3"),
    (FileType.OTHER, "test.txt"),
    (FileType.PDF, "test.pptx"),
    (FileType.PDF, "test.xlsx"),
    (FileType.PDF, "test.msg"),
]

for file_type, filename in test_cases:
    methods = get_available_chunk_methods(file_type, filename)
    default = get_default_chunk_method(file_type, filename)
    print(f"  FileType: {file_type}, Filename: {filename}")
    print(f"    可用方法: {methods}")
    print(f"    默认方法: {default}")
print()

# 测试验证切片方法
print("4. 测试 validate_chunk_method:")
validate_cases = [
    (ChunkMethod.NAIVE, FileType.PDF, "test.pdf", True),
    (ChunkMethod.PICTURE, FileType.PDF, "test.pdf", False),
    (ChunkMethod.PRESENTATION, FileType.PDF, "test.pptx", True),
    (ChunkMethod.TABLE, FileType.PDF, "test.xlsx", True),
    (ChunkMethod.AUDIO, FileType.VISUAL, "test.jpg", False),
    (ChunkMethod.AUDIO, FileType.AURAL, "test.mp3", True),
]

for chunk_method, file_type, filename, expected in validate_cases:
    is_valid, message = validate_chunk_method(chunk_method, file_type, filename)
    print(f"  ChunkMethod: {chunk_method}, FileType: {file_type}, Filename: {filename}")
    print(f"    预期: {'有效' if expected else '无效'}, 实际: {'有效' if is_valid else '无效'}")
    if not is_valid:
        print(f"    消息: {message}")
print()

print("=" * 80)
print("测试完成")
print("=" * 80)
