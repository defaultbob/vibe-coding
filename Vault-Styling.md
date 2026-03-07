# Veeva Vault UI Styling & Layout Guidelines

Use this prompt as a reference when building new pages to ensure consistency with the Veeva Vault UI Kit. It defines the core global styles, common structural components, and specific layout patterns based on the "Type of Page".

## Global CSS Variables & Typography

Ensure these CSS variables are defined in the `:root` of your stylesheet or injected into the tailwind configuration.

```css
:root {
    /* Brand Colors */
    --veeva-blue: #1453b8;
    --veeva-blue-hover: #0f4092;
    --veeva-orange: #f8972b;
    --vault-header-bg: #061937;
    
    /* UI Colors */
    --text-main: #1d1d1d;
    --text-muted: #808080;
    --border-color: #e5e7eb;
    --sidebar-bg: #f8f8f8;
    --grid-header-bg: #c0c0c0;
    --page-bg: #ffffff;
}

body {
    font-family: 'Roboto', sans-serif;
    color: var(--text-main);
    background-color: var(--page-bg);
}
```

## Global Common Components

These components are ubiquitous across almost all Vault applications.

### 1. Global Header (`h-[88px]`)
- **Background**: `bg-[var(--vault-header-bg)]` (Dark Blue)
- **Top Row**: 
  - Left: Veeva Vault logo (Veeva in orange, Vault in white).
  - Center: Global search bar (`bg-white`), containing a dropdown selector and text input.
  - Right: Utility icons (Vault selector, notifications with badge, avatar).
- **Base Tabs Row**: 
  - Background: `bg-[#f8f8f8]`. 
  - Inactive tabs: `text-[14px] text-[#1d1d1d] hover:bg-[#eee]`.
  - Active tab: `bg-white border-b-4 border-[#f8972b] font-bold`. 
  - Contextual Actions: Usually includes a primary "Create" split-button on the far right.

### 2. Standard Buttons
- **Primary**: `bg-[var(--veeva-blue)] text-white hover:bg-[var(--veeva-blue-hover)] rounded shadow-sm text-[14px] font-medium px-4 py-1.5`
- **Secondary**: `bg-white border border-[#dadada] text-[#1d1d1d] hover:bg-gray-50 rounded shadow-sm text-[14px] font-medium px-4 py-1.5`
- **Disabled State**: Apply `opacity-70 cursor-not-allowed` and gray out backgrounds appropriately.

---

## Page Types

When instructed to create a specific type of page, utilize the layout structures defined below. 

### Page Type: Record List
*Examples: "All People", "All Products", "Recent Documents"*

**Layout Structure:**
Uses a 2-column layout below the Global Header.

**1. Left Sidebar / Navigation Panel (`w-[261px]`)**
- **Background**: `bg-[#f8f8f8] border-r border-[#eee]`
- **Header**: E.g., "VIEWS" with a caret icon, `text-[14px] uppercase`.
- **List Items**: `h-[32px] px-[34px] text-[12px] flex items-center gap-2`. 
- **Active Item**: e.g., "All [Entity]", uses `bg-white border-l-4 border-[#f8972b] font-bold text-[#1d1d1d]`.
- **Inactive Items**: e.g., "Recent [Entity]", "Favorites", uses `text-gray-600 hover:text-[#1d1d1d] hover:bg-white`.

**2. Main Content Area (flex-1)**
- **Page Header (`h-[56px]`)**: 
  - **Bottom border**: `border-b-2 border-[#f8972b]`.
  - **Title**: `text-[20px] text-[#1d1d1d]`.
  - **Actions**: e.g., "Save View As" button.
  - **Pagination**: Right-aligned, e.g., "1-25 of 50", standard mock controls.

**3. Empty State (If no records)**
- Centered content with a gray circular background icon.
- **Title**: `text-lg font-semibold text-gray-800` (e.g., "No [Entity] found").
- **Description**: `text-[14px] text-gray-500`.
- **Primary Action**: Button using `btn-primary` styling.

**4. DataGrid**
- **Headers**: `bg-[var(--grid-header-bg)] text-[#1d1d1d] font-bold text-[12px] border-b border-r border-[#a0a0a0] py-2 px-2`.
- **Cells**: `border-b border-r border-[var(--border-color)] bg-white hover:bg-gray-50 py-2 px-2`.

*(When generating a new Record List, dynamically replace `[Entity]` with the target object name across tabs, sidebar links, titles, and empty states.)*
