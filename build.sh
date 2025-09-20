bun build index.ts --minify --target=node --outfile build/dfm.js
bun build index.ts --minify --compile --target=bun-linux-x64 --outfile build/dfm-linux-x64
bun build index.ts --minify --compile --target=bun-linux-x64-baseline --outfile build/dfm-linux-x64-oldcpu
bun build index.ts --minify --compile --target=bun-linux-arm64 --outfile build/dfm-linux-arm64
bun build index.ts --minify --compile --target=bun-windows-x64 --outfile build/dfm-windows-x64.exe
bun build index.ts --minify --compile --target=bun-windows-x64-baseline --outfile build/dfm-windows-x64-oldcpu.exe
bun build index.ts --minify --compile --target=bun-darwin-arm64 --outfile build/dfm-darwin-arm64
bun build index.ts --minify --compile --target=bun-darwin-x64 --outfile build/dfm-darwin-x64