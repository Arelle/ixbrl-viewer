export class ContextMenu {
    constructor({ target = null, menuItems = [], mode = "dark" }) {
      this.target = target;
      this.menuItems = menuItems;
      this.mode = mode;
      this.isOpened = false;
      this._handler = (e) => this._handleContextMenu(e);
    }
    
    getMenuItemsNode(target) {
      const nodes = [];
  
      if (!this.menuItems) {
        console.error("getMenuItemsNode :: Please enter menu items");
        return [];
      }

      var menuItems = this.menuItems;
      if (menuItems instanceof Function) {
        menuItems = menuItems.apply(null, [target]);
      }

      if (menuItems.length > 0) {
        menuItems.forEach((data, index) => {
            const item = this.createItemMarkup(data);
            item.firstChild.setAttribute(
              "style",
              `animation-delay: ${index * 0.08}s`
            );
            nodes.push(item);
        });
      }
  
      return nodes;
    }
  
    createItemMarkup(data) {
      const button = document.createElement("button");
      const item = document.createElement("li");
  
      button.innerHTML = data.content;
      button.classList.add("contextMenu-button");
      item.classList.add("contextMenu-item");
  
      if (data.divider) item.setAttribute("data-divider", data.divider);
      item.appendChild(button);
  
      if (data.events && data.events.length !== 0) {
        Object.entries(data.events).forEach((event) => {
          const [key, value] = event;
          button.addEventListener(key, value);
        });
      }
      button.addEventListener("click", () => this.closeMenu());
  
      return item;
    }
  
    renderMenu(menuItemsNode) {
      const menuContainer = document.createElement("ul");
  
      menuContainer.classList.add("contextMenu");
      menuContainer.setAttribute("data-theme", this.mode);
  
      menuItemsNode.forEach((item) => menuContainer.appendChild(item));  
      return menuContainer;
    }
  
    closeMenu() {
      if (this.isOpened && this._contextMenu) {
        this.isOpened = false;
        this._contextMenu.remove();
        this._contextMenu = null;
      }
    }

    _handleContextMenu(e) {
      const self = this;
      self.closeMenu();

      const document = e.srcElement.ownerDocument;                  
      const { clientX, clientY } = e;
      const target = document.elementFromPoint(clientX, clientY);
      if (target == null) return;
      const menuItemsNode = self.getMenuItemsNode(target);
      if (menuItemsNode.length == 0) return;
      
      e.preventDefault();
      const contextMenu = self.renderMenu(menuItemsNode);
      self.isOpened = true;
      self._contextMenu = contextMenu;

      var interval;
      contextMenu.addEventListener('pointerleave', () => {
        interval = setTimeout(() => {
          self.closeMenu();
        }, 250);
      });
      contextMenu.addEventListener('pointerenter', () => {
        clearTimeout(interval);
      });          

      const body = document.body;
      body.appendChild(contextMenu);

      const positionY =
        clientY + contextMenu.scrollHeight >= window.innerHeight
          ? window.innerHeight - contextMenu.scrollHeight - 20
          : clientY - 10;
      const positionX =
        clientX + contextMenu.scrollWidth >= window.innerWidth
          ? window.innerWidth - contextMenu.scrollWidth - 20
          : clientX - 10;

      contextMenu.setAttribute(
        "style",
        `--width: ${contextMenu.scrollWidth}px;
        --height: ${contextMenu.scrollHeight}px;
        --top: ${positionY}px;
        --left: ${positionX}px;`
      );
    }
  
    init() {
      const self = this;  
      self.target.each( function () {
          this.addEventListener("contextmenu", self._handler);
      });
    }

    destroy() {
      const self = this;  
      this.target.each( function () {
          this.removeEventListener("contextmenu", self._handler);
      });
    } 
  } 
  