# 幸運轉盤

一個可直接部署到 GitHub Pages 的純靜態抽獎網站，不需要伺服器或資料庫。

## 功能

- 最多支援 200 位參加者
- 可直接貼上名單，或匯入 CSV / TXT
- 使用瀏覽器加密亂數公平選出得獎者
- 可設定中獎後自動移除，避免重複中獎
- 保存得獎紀錄、名單與偏好設定
- 支援鍵盤空白鍵、全螢幕與手機版
- 資料只儲存在使用者的瀏覽器中

## 本機開啟

直接用瀏覽器開啟 `index.html` 即可。若要透過本機伺服器預覽，可在此資料夾執行：

```powershell
python -m http.server 8000
```

然後前往 `http://localhost:8000`。

## 部署到 GitHub Pages

1. 在 GitHub 建立一個新的 repository，例如 `lucky-wheel`。
2. 將這個資料夾內的檔案推送到 repository 的 `main` 分支。
3. 開啟 repository 的 **Settings → Pages**。
4. 在 **Build and deployment** 選擇 **Deploy from a branch**。
5. Branch 選擇 `main`，資料夾選擇 `/ (root)`，按下 **Save**。
6. 等候約一至數分鐘，GitHub 會顯示網站網址。

網站通常會位於：

```text
https://你的帳號.github.io/lucky-wheel/
```

## 隱私

參加者名單與得獎紀錄只會保存在目前瀏覽器的 `localStorage`，不會上傳到 GitHub 或其他伺服器。
