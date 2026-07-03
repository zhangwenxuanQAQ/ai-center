document.addEventListener('DOMContentLoaded', function() {
    // 获取所有菜单项
    const menuItems = document.querySelectorAll('.menu-item');
    
    // 页面标题映射（更新为新菜单结构）
    const pageTitles = {
        'appcenter': '应用中心',
        'chat': '聊天',
        'app': '应用管理',
        'chatlog': '问答日志',
        'analytics': '运营分析',
        'agentmanage': '智能体管理',
        'agentplaza': '智能体广场',
        'agentconfig': '智能体配置',
        'prompttemplate': '提示词模板',
        'knowledgecenter': '知识中心',
        'knowledge': '知识库',
        'knowledgetemplate': '知识模板',
        'knowledgedict': '知识字典',
        'datadict': '数据字典',
        'abilitycenter': '能力中心',
        'model': '模型管理',
        'mcp': 'MCP管理',
        'systemconfig': '系统配置',
        'datasource': '数据源管理',
        'monitor': '系统监控'
    };

    // 为每个菜单项添加点击事件
    menuItems.forEach(item => {
        item.addEventListener('click', function(e) {
            e.stopPropagation();
            
            const pageId = this.getAttribute('data-page');
            if (!pageId) return;

            // 获取父级容器（menu-group）
            const menuGroup = this.closest('.menu-group');
            // 获取对应的子菜单
            const submenu = menuGroup ? menuGroup.querySelector('.submenu') : null;
            
            // 判断是否是一级菜单（拥有menu-group父元素）
            const isParentMenu = menuGroup && this.parentElement === menuGroup;
            
            // 如果是一级菜单，切换展开状态
            if (isParentMenu && submenu) {
                // 点击已展开的一级菜单，收起子菜单
                if (this.classList.contains('expanded')) {
                    this.classList.remove('expanded');
                    submenu.classList.remove('expanded');
                    // 移除active状态
                    this.classList.remove('active');
                } else {
                    // 点击未展开的一级菜单，展开子菜单（不收起其他菜单）
                    this.classList.add('expanded');
                    submenu.classList.add('expanded');
                    this.classList.add('active');
                }
                return; // 一级菜单不切换页面
            }

            // 子菜单项的点击处理
            if (this.closest('.submenu')) {
                // 移除所有菜单项的active类
                menuItems.forEach(i => i.classList.remove('active'));
                
                // 给当前菜单项添加active类
                this.classList.add('active');
                
                // 给对应的一级菜单添加active类
                if (menuGroup) {
                    const parentItem = menuGroup.querySelector('.menu-item');
                    if (parentItem) {
                        parentItem.classList.add('active', 'expanded');
                    }
                    if (submenu) {
                        submenu.classList.add('expanded');
                    }
                }

                // 隐藏所有页面内容
                document.querySelectorAll('.page-content').forEach(page => {
                    page.style.display = 'none';
                });

                // 显示对应的页面内容
                const targetPage = document.getElementById(`page-${pageId}`);
                if (targetPage) {
                    targetPage.style.display = 'block';
                }

                // 更新面包屑
                document.getElementById('current-page').textContent = pageTitles[pageId] || pageId;
            }
        });
    });
    
    // 默认展开能力中心菜单（因为模型管理是默认选中的）
    const abilityCenter = document.querySelector('.menu-item[data-page="abilitycenter"]');
    if (abilityCenter) {
        abilityCenter.classList.add('expanded');
        const submenu = abilityCenter.closest('.menu-group').querySelector('.submenu');
        if (submenu) {
            submenu.classList.add('expanded');
        }
    }

    // 默认展开智能体管理菜单
    const agentManage = document.querySelector('.menu-item[data-page="agentmanage"]');
    if (agentManage) {
        agentManage.classList.add('expanded');
        const submenu = agentManage.closest('.menu-group').querySelector('.submenu');
        if (submenu) {
            submenu.classList.add('expanded');
        }
    }

    // 处理分类侧边栏的点击
    const categoryItems = document.querySelectorAll('.category-item');
    categoryItems.forEach(item => {
        item.addEventListener('click', function(e) {
            e.stopPropagation();
            categoryItems.forEach(i => i.classList.remove('active'));
            this.classList.add('active');
        });
    });

    // 处理机器人卡片的点击
    const robotCards = document.querySelectorAll('.robot-card');
    robotCards.forEach(card => {
        card.addEventListener('click', function(e) {
            // 如果点击的是按钮，不触发卡片点击
            if (e.target.closest('.action-btn')) return;
            console.log('机器人卡片被点击:', this.querySelector('.robot-name').textContent);
        });
    });

    // 处理分类展开/收起
    const hasSubItems = document.querySelectorAll('.has-sub');
    hasSubItems.forEach(item => {
        item.addEventListener('click', function(e) {
            e.stopPropagation();
            const icon = this.querySelector('i');
            const subCategory = this.nextElementSibling;
            
            if (subCategory && subCategory.classList.contains('sub-category')) {
                if (subCategory.style.display === 'none') {
                    subCategory.style.display = 'block';
                    icon.classList.remove('fa-chevron-down');
                    icon.classList.add('fa-chevron-up');
                } else {
                    subCategory.style.display = 'none';
                    icon.classList.remove('fa-chevron-up');
                    icon.classList.add('fa-chevron-down');
                }
            }
        });
    });

    // 弹窗相关元素
    const modalOverlay = document.getElementById('modal-overlay');
    const addModal = document.getElementById('add-category-modal');
    const editModal = document.getElementById('edit-category-modal');
    const deleteModal = document.getElementById('delete-confirm-modal');
    const contextMenu = document.getElementById('tree-context-menu');
    
    let currentTreeItem = null;
    let currentMoreBtn = null;

    // 打开弹窗
    function openModal(modal) {
        modalOverlay.style.display = 'flex';
        modal.style.display = 'block';
    }

    // 关闭弹窗
    function closeModal(modal) {
        modalOverlay.style.display = 'none';
        modal.style.display = 'none';
    }

    // 关闭所有弹窗
    function closeAllModals() {
        modalOverlay.style.display = 'none';
        addModal.style.display = 'none';
        editModal.style.display = 'none';
        deleteModal.style.display = 'none';
        contextMenu.style.display = 'none';
    }

    // 加载分类选项到下拉框
    function loadCategoryOptions() {
        const addSelect = document.getElementById('add-parent-category');
        const editSelect = document.getElementById('edit-parent-category');
        
        // 清空现有选项（保留第一个"请选择分类"）
        addSelect.innerHTML = '<option value="">请选择分类</option>';
        editSelect.innerHTML = '<option value="">请选择分类</option>';
        
        // 遍历分类树，获取所有分类（包括子分类）
        const allCategoryItems = document.querySelectorAll('.category-tree .tree-item');
        allCategoryItems.forEach((item, index) => {
            const nameSpan = item.querySelector('.tree-content span');
            if (nameSpan) {
                const name = nameSpan.textContent;
                const value = index + 1;
                
                // 计算层级（根据缩进）
                const treeItem = item.closest('.tree-item');
                const parentChildren = treeItem.parentElement;
                let level = 0;
                if (parentChildren.classList.contains('children')) {
                    level = 1;
                    const grandParent = parentChildren.parentElement;
                    if (grandParent && grandParent.classList.contains('children')) {
                        level = 2;
                    }
                }
                
                // 根据层级添加前缀
                let displayName = name;
                if (level === 1) {
                    displayName = '  └─ ' + name;
                } else if (level === 2) {
                    displayName = '      └─ ' + name;
                }
                
                // 添加到新增弹窗的下拉框
                const addOption = document.createElement('option');
                addOption.value = value;
                addOption.textContent = displayName;
                addSelect.appendChild(addOption);
                
                // 添加到编辑弹窗的下拉框
                const editOption = document.createElement('option');
                editOption.value = value;
                editOption.textContent = displayName;
                editSelect.appendChild(editOption);
            }
        });
    }

    // 点击遮罩关闭弹窗
    modalOverlay.addEventListener('click', closeAllModals);

    // 点击页面其他地方关闭上下文菜单
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.tree-more-btn') && !e.target.closest('.context-menu')) {
            contextMenu.style.display = 'none';
        }
    });

    // 新增分类弹窗关闭按钮
    document.getElementById('add-modal-close').addEventListener('click', function() {
        closeModal(addModal);
    });
    document.getElementById('add-cancel').addEventListener('click', function() {
        closeModal(addModal);
    });

    // 编辑分类弹窗关闭按钮
    document.getElementById('edit-modal-close').addEventListener('click', function() {
        closeModal(editModal);
    });
    document.getElementById('edit-cancel').addEventListener('click', function() {
        closeModal(editModal);
    });

    // 删除确认弹窗关闭按钮
    document.getElementById('delete-modal-close').addEventListener('click', function() {
        closeModal(deleteModal);
    });
    document.getElementById('delete-cancel').addEventListener('click', function() {
        closeModal(deleteModal);
    });

    // 添加分类按钮点击事件（右上角）
    document.getElementById('add-category-btn').addEventListener('click', function() {
        currentTreeItem = null; // 清空当前选中的分类项
        loadCategoryOptions(); // 加载分类选项
        openModal(addModal);
    });

    // 添加子分类按钮点击事件
    document.addEventListener('click', function(e) {
        const addBtn = e.target.closest('.add-child-btn');
        if (addBtn) {
            e.stopPropagation();
            currentTreeItem = addBtn.closest('.tree-item');
            loadCategoryOptions(); // 加载分类选项
            
            // 获取当前分类的名称
            const currentNameSpan = currentTreeItem.querySelector('.tree-content span');
            if (currentNameSpan) {
                const currentName = currentNameSpan.textContent;
                
                // 找到对应的选项并选中
                const addSelect = document.getElementById('add-parent-category');
                for (let i = 0; i < addSelect.options.length; i++) {
                    if (addSelect.options[i].text === currentName || 
                        addSelect.options[i].text.includes(currentName)) {
                        addSelect.selectedIndex = i;
                        break;
                    }
                }
            }
            
            openModal(addModal);
        }
    });

    // 更多操作按钮点击事件
    document.addEventListener('click', function(e) {
        const moreBtn = e.target.closest('.tree-more-btn');
        if (moreBtn) {
            e.stopPropagation();
            currentTreeItem = moreBtn.closest('.tree-item');
            currentMoreBtn = moreBtn;
            
            // 获取按钮位置
            const rect = moreBtn.getBoundingClientRect();
            contextMenu.style.left = rect.left + 'px';
            contextMenu.style.top = rect.bottom + 4 + 'px';
            contextMenu.style.display = 'block';
        }
    });

    // 上下文菜单操作
    document.getElementById('ctx-edit').addEventListener('click', function() {
        contextMenu.style.display = 'none';
        // 填充表单数据（这里可以根据实际数据填充）
        document.getElementById('edit-category-name').value = currentTreeItem.querySelector('span').textContent;
        openModal(editModal);
    });

    document.getElementById('ctx-delete').addEventListener('click', function() {
        contextMenu.style.display = 'none';
        openModal(deleteModal);
    });

    document.getElementById('ctx-up').addEventListener('click', function() {
        contextMenu.style.display = 'none';
        moveTreeItem(currentTreeItem, -1);
    });

    document.getElementById('ctx-down').addEventListener('click', function() {
        contextMenu.style.display = 'none';
        moveTreeItem(currentTreeItem, 1);
    });

    // 上移/下移分类
    function moveTreeItem(item, direction) {
        const parent = item.parentElement;
        const children = Array.from(parent.children).filter(child => child.classList.contains('tree-item'));
        const currentIndex = children.indexOf(item);
        
        if (direction === -1 && currentIndex > 0) {
            // 上移
            parent.insertBefore(item, children[currentIndex - 1]);
        } else if (direction === 1 && currentIndex < children.length - 1) {
            // 下移
            parent.insertBefore(item, children[currentIndex + 2] || null);
        }
    }

    // 确定添加分类
    document.getElementById('add-confirm').addEventListener('click', function() {
        closeModal(addModal);
        alert('分类添加成功！');
    });

    // 确定编辑分类
    document.getElementById('edit-confirm').addEventListener('click', function() {
        const name = document.getElementById('edit-category-name').value;
        if (currentTreeItem && name) {
            currentTreeItem.querySelector('span').textContent = name;
        }
        closeModal(editModal);
        alert('分类编辑成功！');
    });

    // 确定删除分类
    document.getElementById('delete-confirm').addEventListener('click', function() {
        if (currentTreeItem) {
            currentTreeItem.remove();
        }
        closeModal(deleteModal);
        alert('分类删除成功！');
    });

    // 点击箭头图标展开收起
    document.addEventListener('click', function(e) {
        const arrowIcon = e.target.closest('i.fa-chevron-down, i.fa-chevron-right');
        if (arrowIcon) {
            const treeItem = arrowIcon.closest('.tree-item.has-children');
            if (treeItem) {
                e.stopPropagation();
                treeItem.classList.toggle('expanded');
                
                if (treeItem.classList.contains('expanded')) {
                    arrowIcon.classList.remove('fa-chevron-right');
                    arrowIcon.classList.add('fa-chevron-down');
                    const folderIcon = treeItem.querySelector('i.fa-folder, i.fa-folder-open');
                    if (folderIcon) {
                        folderIcon.classList.remove('fa-folder');
                        folderIcon.classList.add('fa-folder-open');
                    }
                } else {
                    arrowIcon.classList.remove('fa-chevron-down');
                    arrowIcon.classList.add('fa-chevron-right');
                    const folderIcon = treeItem.querySelector('i.fa-folder, i.fa-folder-open');
                    if (folderIcon) {
                        folderIcon.classList.remove('fa-folder-open');
                        folderIcon.classList.add('fa-folder');
                    }
                }
            }
        }
    });
    
    // 上移/下移分类
    function moveTreeItem(item, direction) {
        const parent = item.parentElement;
        const children = Array.from(parent.children).filter(child => child.classList.contains('tree-item'));
        const currentIndex = children.indexOf(item);
        
        if (direction === -1 && currentIndex > 0) {
            // 上移
            parent.insertBefore(item, children[currentIndex - 1]);
        } else if (direction === 1 && currentIndex < children.length - 1) {
            // 下移
            parent.insertBefore(item, children[currentIndex + 2] || null);
        }
    }

    // 点击分类项切换选中状态并更新右侧内容
    document.addEventListener('click', function(e) {
        const treeRow = e.target.closest('.tree-row');
        if (treeRow) {
            const addBtn = e.target.closest('.add-child-btn');
            const moreBtn = e.target.closest('.tree-more-btn');
            
            // 如果点击的是添加子分类按钮或更多按钮，不处理选中
            if (addBtn || moreBtn) {
                return;
            }
            
            const treeItem = treeRow.closest('.tree-item');
            if (treeItem) {
                // 移除其他分类的选中状态
                document.querySelectorAll('.tree-item').forEach(item => {
                    item.classList.remove('selected');
                });
                
                // 添加当前分类的选中状态
                treeItem.classList.add('selected');
                
                // 更新右侧分类信息
                const categoryName = treeItem.querySelector('.tree-content span').textContent;
                updateCategoryInfo(categoryName);
            }
        }
    });

    // 更新分类信息
    function updateCategoryInfo(categoryName) {
        const categoryNameEl = document.getElementById('category-name');
        const categoryDescEl = document.getElementById('category-desc');
        const categoryInfoRow = document.getElementById('category-info-row');
        
        if (categoryNameEl && categoryDescEl && categoryInfoRow) {
            if (categoryName === '全部') {
                categoryNameEl.textContent = '全部数据源';
                categoryInfoRow.style.display = 'none';
            } else {
                categoryNameEl.textContent = categoryName;
                categoryDescEl.textContent = '这是一段描述，一段很长的描述。';
                categoryInfoRow.style.display = 'flex';
            }
        }
    }

    // ========== 应用管理页面逻辑 ==========
    const appModalOverlay = document.getElementById('modal-overlay');
    const appAddModal = document.getElementById('app-add-category-modal');
    const appEditModal = document.getElementById('app-edit-category-modal');
    const appDeleteModal = document.getElementById('app-delete-confirm-modal');
    const appContextMenu = document.getElementById('app-tree-context-menu');

    let currentAppTreeItem = null;

    function openAppModal(modal) {
        appModalOverlay.style.display = 'flex';
        modal.style.display = 'block';
    }

    function closeAppModal(modal) {
        appModalOverlay.style.display = 'none';
        modal.style.display = 'none';
    }

    function closeAllAppModals() {
        appModalOverlay.style.display = 'none';
        appAddModal.style.display = 'none';
        appEditModal.style.display = 'none';
        appDeleteModal.style.display = 'none';
        appContextMenu.style.display = 'none';
    }

    // 加载应用分类选项到下拉框
    function loadAppCategoryOptions() {
        const addSelect = document.getElementById('app-add-parent-category');
        const editSelect = document.getElementById('app-edit-parent-category');

        addSelect.innerHTML = '<option value="">请选择分类</option>';
        editSelect.innerHTML = '<option value="">请选择分类</option>';

        const allItems = document.querySelectorAll('.app-category-tree .app-tree-item');
        allItems.forEach((item, index) => {
            const nameSpan = item.querySelector('.app-tree-content span');
            if (nameSpan) {
                const name = nameSpan.textContent;
                const value = index + 1;

                let level = 0;
                const parentChildren = item.parentElement;
                if (parentChildren && parentChildren.classList.contains('app-children')) {
                    level = 1;
                    const grandParent = parentChildren.parentElement;
                    if (grandParent && grandParent.classList.contains('app-children')) {
                        level = 2;
                    }
                }

                let displayName = name;
                if (level === 1) {
                    displayName = '  └─ ' + name;
                } else if (level === 2) {
                    displayName = '      └─ ' + name;
                }

                const addOption = document.createElement('option');
                addOption.value = value;
                addOption.textContent = displayName;
                addSelect.appendChild(addOption);

                const editOption = document.createElement('option');
                editOption.value = value;
                editOption.textContent = displayName;
                editSelect.appendChild(editOption);
            }
        });
    }

    // 点击遮罩关闭弹窗（复用已有遮罩）
    appModalOverlay.addEventListener('click', function() {
        closeAllAppModals();
    });

    // 点击页面其他地方关闭应用分类上下文菜单
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.app-tree-more-btn') && !e.target.closest('#app-tree-context-menu')) {
            if (appContextMenu) appContextMenu.style.display = 'none';
        }
    });

    // 应用分类 - 新增分类按钮
    document.getElementById('app-add-category-btn').addEventListener('click', function() {
        currentAppTreeItem = null;
        loadAppCategoryOptions();
        openAppModal(appAddModal);
    });

    // 应用分类 - 新增弹窗关闭
    document.getElementById('app-add-modal-close').addEventListener('click', function() {
        closeAppModal(appAddModal);
    });
    document.getElementById('app-add-cancel').addEventListener('click', function() {
        closeAppModal(appAddModal);
    });

    // 应用分类 - 编辑弹窗关闭
    document.getElementById('app-edit-modal-close').addEventListener('click', function() {
        closeAppModal(appEditModal);
    });
    document.getElementById('app-edit-cancel').addEventListener('click', function() {
        closeAppModal(appEditModal);
    });

    // 应用分类 - 删除弹窗关闭
    document.getElementById('app-delete-modal-close').addEventListener('click', function() {
        closeAppModal(appDeleteModal);
    });
    document.getElementById('app-delete-cancel').addEventListener('click', function() {
        closeAppModal(appDeleteModal);
    });

    // 应用分类 - 添加子分类按钮
    document.addEventListener('click', function(e) {
        const addBtn = e.target.closest('.app-add-child-btn');
        if (addBtn) {
            e.stopPropagation();
            currentAppTreeItem = addBtn.closest('.app-tree-item');
            loadAppCategoryOptions();

            const currentNameSpan = currentAppTreeItem.querySelector('.app-tree-content span');
            if (currentNameSpan) {
                const currentName = currentNameSpan.textContent;
                const addSelect = document.getElementById('app-add-parent-category');
                for (let i = 0; i < addSelect.options.length; i++) {
                    if (addSelect.options[i].text === currentName ||
                        addSelect.options[i].text.includes(currentName)) {
                        addSelect.selectedIndex = i;
                        break;
                    }
                }
            }
            openAppModal(appAddModal);
        }
    });

    // 应用分类 - 更多操作按钮
    document.addEventListener('click', function(e) {
        const moreBtn = e.target.closest('.app-tree-more-btn');
        if (moreBtn) {
            e.stopPropagation();
            currentAppTreeItem = moreBtn.closest('.app-tree-item');

            const rect = moreBtn.getBoundingClientRect();
            appContextMenu.style.left = rect.left + 'px';
            appContextMenu.style.top = rect.bottom + 4 + 'px';
            appContextMenu.style.display = 'block';
        }
    });

    // 应用分类 - 上下文菜单操作
    document.getElementById('app-ctx-edit').addEventListener('click', function() {
        appContextMenu.style.display = 'none';
        document.getElementById('app-edit-category-name').value = currentAppTreeItem.querySelector('span').textContent;
        openAppModal(appEditModal);
    });

    document.getElementById('app-ctx-delete').addEventListener('click', function() {
        appContextMenu.style.display = 'none';
        openAppModal(appDeleteModal);
    });

    document.getElementById('app-ctx-up').addEventListener('click', function() {
        appContextMenu.style.display = 'none';
        moveAppTreeItem(currentAppTreeItem, -1);
    });

    document.getElementById('app-ctx-down').addEventListener('click', function() {
        appContextMenu.style.display = 'none';
        moveAppTreeItem(currentAppTreeItem, 1);
    });

    // 应用分类 - 上移/下移
    function moveAppTreeItem(item, direction) {
        const parent = item.parentElement;
        const children = Array.from(parent.children).filter(child => child.classList.contains('app-tree-item'));
        const currentIndex = children.indexOf(item);

        if (direction === -1 && currentIndex > 0) {
            parent.insertBefore(item, children[currentIndex - 1]);
        } else if (direction === 1 && currentIndex < children.length - 1) {
            parent.insertBefore(item, children[currentIndex + 2] || null);
        }
    }

    // 应用分类 - 确定添加
    document.getElementById('app-add-confirm').addEventListener('click', function() {
        closeAppModal(appAddModal);
        alert('应用分类添加成功！');
    });

    // 应用分类 - 确定编辑
    document.getElementById('app-edit-confirm').addEventListener('click', function() {
        const name = document.getElementById('app-edit-category-name').value;
        if (currentAppTreeItem && name) {
            currentAppTreeItem.querySelector('span').textContent = name;
        }
        closeAppModal(appEditModal);
        alert('应用分类编辑成功！');
    });

    // 应用分类 - 确定删除
    document.getElementById('app-delete-confirm').addEventListener('click', function() {
        if (currentAppTreeItem) {
            currentAppTreeItem.remove();
        }
        closeAppModal(appDeleteModal);
        alert('应用分类删除成功！');
    });

    // 应用分类 - 点击箭头展开收起
    document.addEventListener('click', function(e) {
        const arrowIcon = e.target.closest('.app-category-tree i.fa-chevron-down, .app-category-tree i.fa-chevron-right');
        if (arrowIcon) {
            const treeItem = arrowIcon.closest('.app-tree-item.has-children');
            if (treeItem) {
                e.stopPropagation();
                treeItem.classList.toggle('expanded');

                if (treeItem.classList.contains('expanded')) {
                    arrowIcon.classList.remove('fa-chevron-right');
                    arrowIcon.classList.add('fa-chevron-down');
                    const folderIcon = treeItem.querySelector(':scope > .app-tree-row i.fa-folder, :scope > .app-tree-row i.fa-folder-open');
                    if (folderIcon) {
                        folderIcon.classList.remove('fa-folder');
                        folderIcon.classList.add('fa-folder-open');
                    }
                } else {
                    arrowIcon.classList.remove('fa-chevron-down');
                    arrowIcon.classList.add('fa-chevron-right');
                    const folderIcon = treeItem.querySelector(':scope > .app-tree-row i.fa-folder, :scope > .app-tree-row i.fa-folder-open');
                    if (folderIcon) {
                        folderIcon.classList.remove('fa-folder-open');
                        folderIcon.classList.add('fa-folder');
                    }
                }
            }
        }
    });

    // 应用分类 - 点击分类项切换选中状态并更新右侧内容
    document.addEventListener('click', function(e) {
        const treeRow = e.target.closest('.app-tree-row');
        if (treeRow) {
            const addBtn = e.target.closest('.app-add-child-btn');
            const moreBtn = e.target.closest('.app-tree-more-btn');
            if (addBtn || moreBtn) return;

            const treeItem = treeRow.closest('.app-tree-item');
            if (treeItem) {
                document.querySelectorAll('.app-tree-item').forEach(item => {
                    item.classList.remove('selected');
                });
                treeItem.classList.add('selected');

                const categoryName = treeItem.querySelector('.app-tree-content span').textContent;
                updateAppCategoryInfo(categoryName);
            }
        }
    });

    // 更新应用分类信息
    function updateAppCategoryInfo(categoryName) {
        const categoryNameEl = document.getElementById('app-category-name');
        const categoryDescEl = document.getElementById('app-category-desc');
        const categoryTimeEl = document.getElementById('app-category-time');
        const categoryInfoRow = document.getElementById('app-category-info-row');

        if (categoryNameEl && categoryDescEl && categoryInfoRow) {
            if (categoryName === '全部') {
                categoryNameEl.textContent = '全部应用';
                categoryInfoRow.style.display = 'none';
            } else {
                categoryNameEl.textContent = categoryName;
                categoryDescEl.textContent = '应用分类描述信息';
                categoryTimeEl.textContent = '2026/06/11 10:00:00';
                categoryInfoRow.style.display = 'flex';
            }
        }
    }

    // 新增应用弹窗功能
    const appAddAppModal = document.getElementById('app-add-modal');

    document.getElementById('app-add-btn').addEventListener('click', function() {
        openAppModal(appAddAppModal);
    });

    document.getElementById('app-add-modal-close').addEventListener('click', function() {
        closeAppModal(appAddAppModal);
    });

    document.getElementById('app-add-btn-cancel').addEventListener('click', function() {
        closeAppModal(appAddAppModal);
    });

    document.getElementById('app-add-btn-confirm').addEventListener('click', function() {
        const name = document.getElementById('app-add-name').value;
        const code = document.getElementById('app-add-code').value;
        const source = document.getElementById('app-add-source').value;
        const category = document.getElementById('app-add-category').value;
        const desc = document.getElementById('app-add-desc').value;

        if (!name) {
            alert('请输入应用名称');
            return;
        }
        if (!code) {
            alert('请输入应用编码');
            return;
        }
        if (!category) {
            alert('请选择所属分类');
            return;
        }

        closeAppModal(appAddAppModal);
        alert('应用添加成功！');

        document.getElementById('app-add-name').value = '';
        document.getElementById('app-add-code').value = '';
        document.getElementById('app-add-source').value = 'local';
        document.getElementById('app-add-category').value = '';
        document.getElementById('app-add-desc').value = '';
    });

    // 模型类型筛选功能
    document.addEventListener('click', function(e) {
        const typeTag = e.target.closest('.type-tags .type-tag');
        if (typeTag) {
            const typeTags = document.querySelectorAll('.type-tags .type-tag');
            typeTags.forEach(tag => tag.classList.remove('active'));
            typeTag.classList.add('active');
            filterModels();
        }
    });

    // 模型状态和连接状态筛选功能
    function filterModels() {
        const typeTags = document.querySelectorAll('.type-tags .type-tag');
        let selectedType = 'all';
        typeTags.forEach(tag => {
            if (tag.classList.contains('active')) {
                selectedType = tag.getAttribute('data-type');
            }
        });

        const modelStatusFilter = document.querySelector('.model-status-filter');
        const selectedModelStatus = modelStatusFilter ? modelStatusFilter.value : 'all';

        const connectionStatusFilter = document.querySelector('.connection-status-filter');
        const selectedConnectionStatus = connectionStatusFilter ? connectionStatusFilter.value : 'all';

        const modelCards = document.querySelectorAll('.model-card');
        modelCards.forEach(card => {
            const cardType = card.getAttribute('data-type');
            const cardModelStatus = card.getAttribute('data-model-status');
            const cardConnectionStatus = card.getAttribute('data-connection-status');

            const typeMatch = selectedType === 'all' || cardType === selectedType;
            const modelStatusMatch = selectedModelStatus === 'all' || cardModelStatus === selectedModelStatus;
            const connectionStatusMatch = selectedConnectionStatus === 'all' || cardConnectionStatus === selectedConnectionStatus;

            if (typeMatch && modelStatusMatch && connectionStatusMatch) {
                card.style.display = 'block';
            } else {
                card.style.display = 'none';
            }
        });
    }

    document.addEventListener('change', function(e) {
        if (e.target.classList.contains('model-status-filter') || e.target.classList.contains('connection-status-filter')) {
            filterModels();
        }
    });

    // 模型卡片操作按钮
    document.addEventListener('click', function(e) {
        const testBtn = e.target.closest('.model-card .action-btn.test');
        if (testBtn) {
            e.stopPropagation();
            const modelCard = testBtn.closest('.model-card');
            const modelName = modelCard.querySelector('.model-title').textContent;
            alert(`正在测试 ${modelName} 的链接...\n\n测试结果：连接成功！`);
        }

        const editBtn = e.target.closest('.model-card .action-btn.edit');
        if (editBtn) {
            e.stopPropagation();
            const modelCard = editBtn.closest('.model-card');
            const modelName = modelCard.querySelector('.model-title').textContent;
            alert(`正在编辑 ${modelName}...`);
        }

        const deleteBtn = e.target.closest('.model-card .action-btn.delete');
        if (deleteBtn) {
            e.stopPropagation();
            const modelCard = deleteBtn.closest('.model-card');
            const modelName = modelCard.querySelector('.model-title').textContent;
            if (confirm(`确定要删除模型 "${modelName}" 吗？`)) {
                modelCard.remove();
                alert('模型删除成功！');
            }
        }
    });

    document.getElementById('theme-toggle').addEventListener('click', function() {
        const body = document.body;
        const icon = this.querySelector('i');
        
        if (body.classList.contains('dark-mode')) {
            body.classList.remove('dark-mode');
            body.classList.add('light-mode');
            icon.classList.remove('fa-moon');
            icon.classList.add('fa-sun');
            localStorage.setItem('theme', 'light');
        } else {
            body.classList.remove('light-mode');
            body.classList.add('dark-mode');
            icon.classList.remove('fa-sun');
            icon.classList.add('fa-moon');
            localStorage.setItem('theme', 'dark');
        }
    });

    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        const body = document.body;
        body.classList.remove('dark-mode', 'light-mode');
        body.classList.add(savedTheme + '-mode');
        const icon = document.getElementById('theme-toggle').querySelector('i');
        if (savedTheme === 'dark') {
            icon.classList.remove('fa-sun');
            icon.classList.add('fa-moon');
        } else {
            icon.classList.remove('fa-moon');
            icon.classList.add('fa-sun');
        }
    }
});