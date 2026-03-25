@echo off
echo Deploying VM Dashboard to Azure Static Web Apps...
cd /d "%~dp0"
npx swa deploy src --api-location api --api-language node --api-version 18 --deployment-token "36a4400e287a8763ba922e48b605de3d4e0c1e2d70a75cedd7759ab965a2e66d02-ee926926-00a1-4cb8-bfa6-4182d9075ec100f1314028c1290f" --env production
echo.
if %ERRORLEVEL% EQU 0 (
    echo Deploy successful!
) else (
    echo Deploy FAILED!
)
pause
