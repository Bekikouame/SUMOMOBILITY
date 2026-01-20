@echo off
echo Generating Prisma Client...
cd /d "%~dp0"
node node_modules\prisma\build\index.js generate
echo Done!
pause
