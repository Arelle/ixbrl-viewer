export class ContextMenu {
    constructor({ target = null, menuItems = [], mode = "dark" }) {
      this.target = target;
      this.menuItems = menuItems;
      this.mode = mode;
      this.isOpened = false;
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

      menuItems.forEach((data, index) => {
        const item = this.createItemMarkup(data);
        item.firstChild.setAttribute(
          "style",
          `animation-delay: ${index * 0.08}s`
        );
        nodes.push(item);
      });
  
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
  
    init() {
      const self = this;  

      this.target.each( function () {
        this.addEventListener("contextmenu", (e) => {
          self.closeMenu();

          const menuItemsNode = self.getMenuItemsNode(this);
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

          const { clientX, clientY } = e;
          const body = this.ownerDocument.body;
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
        });
      });
    }
  } 
  