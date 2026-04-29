#
#  Copyright 2025 The InfiniFlow Authors. All Rights Reserved.
#
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#
#      http://www.apache.org/licenses/LICENSE-2.0
#
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
#

import os

# PDF解析并行设备数量
PARALLEL_DEVICES = int(os.getenv("PARALLEL_DEVICES", "1"))
DOC_MAXIMUM_SIZE = int(os.getenv("DOC_MAXIMUM_SIZE", 128 * 1024 * 1024))
DOC_BULK_SIZE = int(os.getenv("PARALLEL_DEVICES", "5"))
EMBEDDING_BATCH_SIZE = int(os.getenv("PARALLEL_DEVICES", "16"))
