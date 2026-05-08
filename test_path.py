from pathlib import Path

file_utils_path = Path(__file__).parent / 'app' / 'core' / 'knowledgebase' / 'utils' / 'file_utils.py'
print('file_utils.py path:', file_utils_path)

project_root = file_utils_path.resolve().parents[5]
print('Project root:', project_root)

custom_icon_path = project_root / 'web' / 'src' / 'assets' / 'svg' / 'file-icon' / 'sql.svg'
print('Icon path:', custom_icon_path)
print('Exists:', custom_icon_path.exists())

print()
print('Listing file-icon folder:')
icon_folder = project_root / 'web' / 'src' / 'assets' / 'svg' / 'file-icon'
for f in icon_folder.iterdir():
    print(f'  {f.name}')
