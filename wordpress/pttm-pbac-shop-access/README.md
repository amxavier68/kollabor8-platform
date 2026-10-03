# PTTM PBAC Shop Access

Installable WordPress plugin for Wendy / PTTM shop operators.

## Role

Creates:

`PTTM Shop Operator`

The role is intended for day-to-day PTTM operation, not platform administration.

### Allowed
- Products and product categories
- WooCommerce order handling
- Posts
- Pages / Elementor content
- Media
- Comment moderation
- WooCommerce reports

### Restricted
- Plugins
- Themes
- Users and roles
- Site-wide settings
- Core updates
- Code editors
- K8 credentials and governance

## Login experience

The standard WordPress login screen is branded with a PTTM Shop Workspace panel that tells the operator what the role can do before sign-in.

After login, PTTM Shop Operators land on **PTTM Workspace**, which shows:
- allowed actions
- owner/admin-controlled actions
- quick buttons for Add Product, Add Post, Add Page, Upload Media and View Orders

## Assignment

After activating the plugin:
1. Create or edit Wendy's WordPress user.
2. Set role to **PTTM Shop Operator**.
3. Wendy continues to use the normal WordPress login URL.
4. She is redirected to the PBAC workspace after login.

Do not give this role Administrator.
