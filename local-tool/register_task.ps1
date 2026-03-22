$action = New-ScheduledTaskAction -Execute "C:\Users\meiek\Desktop\ClaudeCode-projects\galchan-app\local-tool\run_sheets_to_obsidian.bat"
$trigger = New-ScheduledTaskTrigger -Daily -At "13:45"
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -RunOnlyIfNetworkAvailable
Register-ScheduledTask -TaskName "galchan_sheets_to_obsidian" -Action $action -Trigger $trigger -Settings $settings -Description "galchan daily update" -Force
Write-Output "Done"
