# Meta Lead Ads discovery bridge

Run `install.py` in the existing project's Google Cloud Shell. The installer uses the
current deployed source archive, checks the expected server hash and runtime identity,
deploys without changing traffic, checks the new endpoint, and promotes only if the
existing traffic did not change. Rollback is saved under the owner's home directory.
Google reporting endpoints and its existing Scheduler job are preserved.

The bridge reads all paginated accessible pages, including promoted, business-owned
and business-client pages. It sends page credentials to the existing reporting Worker
with its runtime service account's signed Google OIDC identity. Credentials are
AES-GCM encrypted in D1. The response contains counts and permission error codes only.
Pages with missing lead-retrieval permission are not described as connected.

After discovery, bind each page to its project in the master CRM settings, configure
the Meta app's Page/leadgen callback shown there, then subscribe the bound page.
Configure the project's dataset for QualifiedLead and ConvertedLead delivery. An
accepted message from Meta must be verified before calling this connection live.

Instagram Direct and WhatsApp Business are **not activated** by this installer.
Their future inbound webhook, project bindings and message storage exist separately.
No campaigns, budgets or ads are modified.

## One Cloud Shell command

Open Cloud Shell in `toys-codex-media-buyer`, then run:

```bash
mkdir -p "$HOME/toys-crm-connect"
curl -fL 'https://raw.githubusercontent.com/toysagency01-bot/toys-reporting/95d835a/platform/cloudrun-crm/update.zip' -o "$HOME/toys-crm-connect/update.zip" && unzip -o "$HOME/toys-crm-connect/update.zip" -d "$HOME/toys-crm-connect" && python3 "$HOME/toys-crm-connect/install.py"
```

Send only the final `pages`, `pagesWithToken`, `accounts` counts / permission warnings
or the `STOP` message. Do not send tokens or environment variables.
