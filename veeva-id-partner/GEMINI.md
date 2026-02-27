# Veeva ID partner demo

You will build a sample implementation of how VeevaID Partners would use VeevaID to authenticate a user for their site:
1. A simple button that says log in with VeevaID
2. User logs in with their VeevaID credentials
3. Site displays user metadata retrieved from VeevaID

See VeevaID Partner API Documentation:
@./documentation.md

**Client ID:** david-mills-demo

Create 2 pages, in 2 directories under the root of my sire, one for [DEV](id.veevadev.com) and one for [PROD](id.veeva.com).

Provide one file for both to pass to Veeva like the below. If unsure of a value use the example
```json
{
  "client_id": "bryan_postman",
  "app_name": "bryan_app",
  "app_short_name": "BP",
  "app_short_description": "bp_test_app_description",
  "app_dns": "https://update-app-dns.vaultdev.com",
  "app_home_url": "https://devauth1.vaultdev.com/auth/login",
  "app_svg_logo_url": "https://static-assets.vaultdev.com/auth/static/images/vault-login-logo.36f81ef1.svg",
  "app_callback_urls": {
    "notification_callback_urls": {
      "app_novuid_registration": "https://id.veevadev.com/my-account",
      "app_activevuid_registration": "https://devauth1.vaultdev.com/auth/login",
      "forgot_password": "https://devauth1.vaultdev.com/auth/login",
      "verify_secondary_email": "https://devauth1.vaultdev.com/auth/login"
    },
    "user_attribute_callback_url": "https://devauth1.vaultdev.com/auth/login",
    "check_switch_callback_url": "https://devauth1.vaultdev.com/auth/login"
  },
  "oauth_redirect_urls": [
    "https://oauth.pstmn.io/v1/callback"
  ],
  "expose_tenant_in_portal": false,
  "tenant_list_url": "https://devauth1.vaultdev.com:443/auth/api/veevaid/tenant_list",
  "registration_type": "NON_VAULT_APP",
  "use_interstitial": true
}
```

* `app_dns` requires https://
* `app_short_description` cannot have spaces