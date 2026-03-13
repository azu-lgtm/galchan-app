@echo off
chcp 65001 > nul
echo ガルちゃん自動化ツール 起動中...
echo.
echo VOICEVOX が起動していることを確認してください
echo フォルダ監視: tsv_input\
echo.
python galchan_auto.py
pause
