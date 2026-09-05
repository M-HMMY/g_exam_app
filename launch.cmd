@echo off
title G検定 学習アプリ
cd /d "%~dp0"

if not exist "node_modules\vite" (
  echo 初回のみ、依存パッケージを入れます。数分かかることがあります。
  call npm install
  if errorlevel 1 goto :failed
)

echo 開発サーバを起動します。ブラウザが自動で開きます。
echo このウィンドウを閉じるとアプリは止まります。
call npm run dev -- --open
if errorlevel 1 goto :failed
exit /b 0

:failed
echo.
echo 起動に失敗しました。上に出ている内容を確認してください。
pause
exit /b 1
