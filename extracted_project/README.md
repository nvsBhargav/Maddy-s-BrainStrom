# BrainVault static preview bundle

This is the existing static app (HTML, CSS, and JavaScript modules); there is no separate build step. The files and relative paths are preserved, and the app source has not been modified.

## Run locally

1. Extract this bundle.
2. Open a terminal in the extracted `BrainVault-static` folder.
3. Run `py serve.py 8080` (or `python serve.py 8080`).
4. Open http://127.0.0.1:8080/ in a browser.

The included server binds to localhost only. If port 8080 is occupied, choose another port, e.g. `py serve.py 5000`, and open the matching localhost URL.
