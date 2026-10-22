export const WINDOWS_FILE_COMMANDS = [
  "ls",
  "cd",
  "mkdir",
  "rm",
  "rmdir",
  "cp",
  "mv",
  "cat",
  "head",
  "tail",
  "du",
  "file",
  "stat",
  "touch",
  "wc",
  "zip",
  "unzip",
  "tar",
  "gzip",
  "gunzip",
  "bzip2",
] as const

const LIST = "CONSOLESS_LIST"
const PATH = "CONSOLESS_PATH"
const DEST = "CONSOLESS_DEST"
const COUNT = "CONSOLESS_COUNT"

const LIST_FILES = `$env:${LIST} -split '\\|' | ForEach-Object { Remove-Item -LiteralPath $_ -Force }`
const LIST_TREE = `$env:${LIST} -split '\\|' | ForEach-Object { Remove-Item -LiteralPath $_ -Recurse -Force }`
const ONE_FOLDER = `Get-ChildItem -LiteralPath $env:${PATH} -Force | ForEach-Object { if ($_.PSIsContainer) { $_.Name + '/' } else { $_.Name } }`
const ONE_MOVE = `Set-Location -LiteralPath $env:${PATH}; (Get-Location).Path`
const ONE_MAKE = `New-Item -ItemType Directory -Path $env:${PATH} | Out-Null`
const ONE_EMPTY = `$children = @(Get-ChildItem -LiteralPath $env:${PATH} -Force); if ($children.Count -gt 0) { throw 'That folder is not empty.' }; Remove-Item -LiteralPath $env:${PATH} -Force`
const COPY_FILES = `$env:${LIST} -split '\\|' | ForEach-Object { Copy-Item -LiteralPath $_ -Destination $env:${DEST} }`
const MOVE_FILES = `$env:${LIST} -split '\\|' | ForEach-Object { Move-Item -LiteralPath $_ -Destination $env:${DEST} }`
const SHOW_FILE = `Get-Content -LiteralPath $env:${PATH} -Raw`
const SHOW_HEAD = `Get-Content -LiteralPath $env:${PATH} -TotalCount ([int]$env:${COUNT})`
const SHOW_TAIL = `Get-Content -LiteralPath $env:${PATH} -Tail ([int]$env:${COUNT})`
const SHOW_SIZE = `$item = Get-Item -LiteralPath $env:${PATH} -Force; $bytes = 0; if (-not $item.PSIsContainer) { $bytes = $item.Length } else { $bytes = (Get-ChildItem -LiteralPath $env:${PATH} -Recurse -Force -File -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum }; if ($null -eq $bytes) { $bytes = 0 }; $value = [double]$bytes; $units = @('B','K','M','G','T'); $index = 0; while ($value -ge 1024 -and $index -lt 4) { $value = $value / 1024; $index++ }; if ($index -eq 0) { '{0}B' -f [int64]$bytes } else { '{0}{1}' -f ([math]::Round($value, 1).ToString([cultureinfo]::InvariantCulture)), $units[$index] }`
const SHOW_KIND = `$item = Get-Item -LiteralPath $env:${PATH} -Force; if ($item.PSIsContainer) { 'directory' } elseif ($item.Length -eq 0) { 'empty file' } else { $ext = $item.Extension.TrimStart('.').ToLower(); if ($ext) { "$ext file" } else { 'file' } }`
const SHOW_DETAILS = `$item = Get-Item -LiteralPath $env:${PATH} -Force; $size = 0; if (-not $item.PSIsContainer) { $size = $item.Length }; 'Size {0} bytes' -f $size; 'Modified {0:yyyy-MM-dd HH:mm}' -f $item.LastWriteTime; 'Created {0:yyyy-MM-dd HH:mm}' -f $item.CreationTime; 'Attributes {0}' -f $item.Attributes`
const MAKE_FILE = `if (Test-Path -LiteralPath $env:${PATH}) { throw 'That file already exists.' }; New-Item -ItemType File -Path $env:${PATH} | Out-Null`
const COUNT_FILE = `$item = Get-Item -LiteralPath $env:${PATH} -Force; if ($item.PSIsContainer) { throw 'Choose a file.' }; $lines = 0; $words = 0; Get-Content -LiteralPath $env:${PATH} | ForEach-Object { $lines++; $words += @($_.Split(' ', [StringSplitOptions]::RemoveEmptyEntries)).Count }; '{0} {1} {2}' -f $lines, $words, $item.Length`
const PACK_ZIP = `$items = @($env:${LIST} -split '\\|'); Compress-Archive -LiteralPath $items -DestinationPath $env:${DEST}`
const UNPACK_ZIP = `Add-Type -AssemblyName System.IO.Compression.FileSystem; $zip = [System.IO.Compression.ZipFile]::OpenRead($env:${PATH}); try { if ($zip.Entries.Count -eq 0) { throw 'That archive is empty.' }; if ($zip.Entries.Count -gt 5000) { throw 'That archive has too many files.' }; foreach ($entry in $zip.Entries) { $name = $entry.FullName-replace '\\\\','/'.TrimEnd('/'); if (-not $name) { continue }; foreach ($part in $name.Split('/')) { if ($part -eq '' -or $part -eq '.' -or $part -eq '..') { throw 'That archive contains a path that leaves its folder.' } } } } finally { $zip.Dispose() }; Expand-Archive -LiteralPath $env:${PATH} -DestinationPath $env:${DEST}`
const PACK_TAR = `$names = @($env:${LIST} -split '\\|'); & tar.exe -czf $env:${DEST} -C $env:${PATH} @names; if ($LASTEXITCODE -ne 0) { throw 'The archive could not be created.' }`
const UNPACK_TAR = `$listed = & tar.exe -tf $env:${PATH}; if ($LASTEXITCODE -ne 0) { throw 'That archive could not be read.' }; $names = @($listed | Where-Object { $_.Trim() -ne '' }); if ($names.Count -eq 0) { throw 'That archive is empty.' }; if ($names.Count -gt 5000) { throw 'That archive has too many files.' }; foreach ($raw in $names) { $name = $raw-replace '\\\\','/'.TrimEnd('/'); foreach ($part in $name.Split('/')) { if ($part -eq '' -or $part -eq '.' -or $part -eq '..') { throw 'That archive contains a path that leaves its folder.' } } }; New-Item -ItemType Directory -Path $env:${DEST} | Out-Null; & tar.exe -xf $env:${PATH} -C $env:${DEST}; if ($LASTEXITCODE -ne 0) { Remove-Item -LiteralPath $env:${DEST} -Recurse -Force -ErrorAction SilentlyContinue; throw 'That archive could not be unpacked.' }`
const COMPRESS_GZIP = `$in = $env:${PATH}; $out = $in + '.gz'; if (Test-Path -LiteralPath $out) { throw 'That compressed file already exists.' }; $source = [System.IO.File]::OpenRead($in); try { $dest = [System.IO.File]::Create($out); try { $gzip = New-Object System.IO.Compression.GzipStream($dest, [System.IO.Compression.CompressionMode]::Compress); try { $source.CopyTo($gzip) } finally { $gzip.Dispose() } } finally { $dest.Dispose() } } finally { $source.Dispose() }`
const RESTORE_GZIP = `$in = $env:${PATH}; if (-not $in.ToLower().EndsWith('.gz')) { throw 'Choose a .gz file.' }; $out = $in.Substring(0, $in.Length - 3); if (Test-Path -LiteralPath $out) { throw 'That file already exists.' }; $source = [System.IO.File]::OpenRead($in); try { $gzip = New-Object System.IO.Compression.GzipStream($source, [System.IO.Compression.CompressionMode]::Decompress); try { $dest = [System.IO.File]::Create($out); try { $gzip.CopyTo($dest) } finally { $dest.Dispose() } } finally { $gzip.Dispose() } } finally { $source.Dispose() }`
const COMPRESS_BZIP = `$in = $env:${PATH}; $out = $in + '.bz2'; if (Test-Path -LiteralPath $out) { throw 'That compressed file already exists.' }; $dir = Split-Path -LiteralPath $in -Parent; $name = Split-Path -LiteralPath $in -Leaf; & tar.exe -cjf $out -C $dir $name; if ($LASTEXITCODE -ne 0) { throw 'The file could not be compressed.' }`
const RESTORE_BZIP = `$in = $env:${PATH}; if (-not $in.ToLower().EndsWith('.bz2')) { throw 'Choose a .bz2 file.' }; $dir = Split-Path -LiteralPath $in -Parent; $listed = & tar.exe -tjf $in; if ($LASTEXITCODE -ne 0) { throw 'That archive could not be read.' }; $names = @($listed | Where-Object { $_.Trim() -ne '' }); foreach ($raw in $names) { $name = $raw-replace '\\\\','/'.TrimEnd('/'); foreach ($part in $name.Split('/')) { if ($part -eq '' -or $part -eq '.' -or $part -eq '..') { throw 'That archive contains a path that leaves its folder.' } } }; & tar.exe -xjf $in -C $dir; if ($LASTEXITCODE -ne 0) { throw 'The file could not be restored.' }`

export function isWindowsFileCommand(name: string): boolean {
  return (WINDOWS_FILE_COMMANDS as readonly string[]).includes(name)
}

export function windowsPreview(platform: string, name: string, args: string[]): string[] | null {
  if (platform !== "win32" || !isWindowsFileCommand(name)) return null
  if (name === "ls") return ["Get-ChildItem", args[1] ?? ""]
  if (name === "cd") return ["Set-Location", args[0] ?? ""]
  if (name === "mkdir") return ["New-Item", "-ItemType", "Directory", args[0] ?? ""]
  if (name === "rmdir") return ["Remove-Item", args[0] ?? ""]
  if (name === "rm") return args[0] === "-r" ? ["Remove-Item", "-Recurse", ...args.slice(1)] : ["Remove-Item", ...args]
  if (name === "cp") return ["Copy-Item", ...args]
  if (name === "mv") return ["Move-Item", ...args]
  if (name === "cat") return ["Get-Content", args[0] ?? ""]
  if (name === "head") return ["Get-Content", "-TotalCount", args[1] ?? "", args[2] ?? ""]
  if (name === "tail") return ["Get-Content", "-Tail", args[1] ?? "", args[2] ?? ""]
  if (name === "du") return ["Measure", args[2] ?? ""]
  if (name === "file") return ["Kind", args[1] ?? ""]
  if (name === "stat") return ["Details", args[1] ?? ""]
  if (name === "touch") return ["New-Item", "-ItemType", "File", args[0] ?? ""]
  if (name === "wc") return ["Measure", args[0] ?? ""]
  if (name === "zip") return ["Compress-Archive", args[2] ?? "", ...args.slice(3)]
  if (name === "unzip") return ["Expand-Archive", args[3] ?? "", args[2] ?? ""]
  if (name === "tar" && args[0] === "-czf") return ["tar", "-czf", args[1] ?? "", ...args.slice(4)]
  if (name === "tar") return ["tar", "-xf", args[1] ?? "", args[3] ?? ""]
  if (name === "gzip") return ["gzip", args[2] ?? ""]
  if (name === "gunzip") return ["gunzip", args[1] ?? ""]
  if (name === "bzip2" && args[0] === "-d") return ["bzip2", "-d", args[2] ?? ""]
  if (name === "bzip2") return ["bzip2", args[1] ?? ""]
  return null
}

export function windowsFileLaunch(name: string, args: string[]): { script: string; env: Record<string, string> } | { error: string } {
  if (!isWindowsFileCommand(name)) return { error: "That command is not available." }
  if (name === "ls") return one(ONE_FOLDER, args[1] ?? "")
  if (name === "cd") return one(ONE_MOVE, args[0] ?? "")
  if (name === "mkdir") return one(ONE_MAKE, args[0] ?? "")
  if (name === "rmdir") return one(ONE_EMPTY, args[0] ?? "")
  if (name === "rm") return listScript(args[0] === "-r" ? LIST_TREE : LIST_FILES, args[0] === "-r" ? args.slice(1) : args)
  if (name === "cp" || name === "mv") return transfer(name === "cp" ? COPY_FILES : MOVE_FILES, args)
  if (name === "cat") return one(SHOW_FILE, args[0] ?? "")
  if (name === "head" || name === "tail") return lines(name === "head" ? SHOW_HEAD : SHOW_TAIL, args[2] ?? "", args[1] ?? "")
  if (name === "du") return one(SHOW_SIZE, args[2] ?? "")
  if (name === "file") return one(SHOW_KIND, args[1] ?? "")
  if (name === "stat") return one(SHOW_DETAILS, args[1] ?? "")
  if (name === "touch") return one(MAKE_FILE, args[0] ?? "")
  if (name === "wc") return one(COUNT_FILE, args[0] ?? "")
  if (name === "zip") return pair(PACK_ZIP, args.slice(3), args[2] ?? "")
  if (name === "unzip") return two(UNPACK_ZIP, args[3] ?? "", args[2] ?? "")
  if (name === "tar" && args[0] === "-czf") return tarPack(args)
  if (name === "tar") return two(UNPACK_TAR, args[1] ?? "", args[3] ?? "")
  if (name === "gzip") return one(COMPRESS_GZIP, args[2] ?? "")
  if (name === "gunzip") return one(RESTORE_GZIP, args[1] ?? "")
  if (name === "bzip2" && args[0] === "-d") return one(RESTORE_BZIP, args[2] ?? "")
  if (name === "bzip2") return one(COMPRESS_BZIP, args[1] ?? "")
  return { error: "That command is not available." }
}

function one(script: string, target: string): { script: string; env: Record<string, string> } | { error: string } {
  const path = safePath(target)
  if (typeof path === "object") return path
  return { script, env: { [PATH]: path } }
}

function lines(script: string, target: string, count: string): { script: string; env: Record<string, string> } | { error: string } {
  if (!/^\d+$/.test(count) || Number(count) < 1 || Number(count) > 200) return { error: "Choose one file." }
  const path = safePath(target)
  if (typeof path === "object") return path
  return { script, env: { [PATH]: path, [COUNT]: count } }
}

function listScript(script: string, paths: string[]): { script: string; env: Record<string, string> } | { error: string } {
  const list = joinList(paths)
  if (typeof list === "object") return list
  return { script, env: { [LIST]: list } }
}

function transfer(script: string, args: string[]): { script: string; env: Record<string, string> } | { error: string } {
  return pair(script, args.slice(0, -1), args[args.length - 1] ?? "")
}

function pair(script: string, sources: string[], destination: string): { script: string; env: Record<string, string> } | { error: string } {
  const list = joinList(sources)
  const dest = safePath(destination)
  if (typeof list === "object") return list
  if (typeof dest === "object") return dest
  return { script, env: { [LIST]: list, [DEST]: dest } }
}

function two(script: string, source: string, destination: string): { script: string; env: Record<string, string> } | { error: string } {
  const path = safePath(source)
  const dest = safePath(destination)
  if (typeof path === "object") return path
  if (typeof dest === "object") return dest
  return { script, env: { [PATH]: path, [DEST]: dest } }
}

function tarPack(args: string[]): { script: string; env: Record<string, string> } | { error: string } {
  const dest = safePath(args[1] ?? "")
  const root = safePath(args[3] ?? "")
  const names = args.slice(4)
  if (typeof dest === "object") return dest
  if (typeof root === "object") return root
  if (names.length === 0 || names.some((name) => !plainPiece(name))) return { error: "Choose files inside your home folder." }
  return { script: PACK_TAR, env: { [DEST]: dest, [PATH]: root, [LIST]: names.join("|") } }
}

function joinList(paths: string[]): string | { error: string } {
  if (paths.length === 0) return { error: "Choose a file or folder." }
  const clean = paths.map(safePath)
  const problem = clean.find((item) => typeof item === "object")
  if (problem && typeof problem === "object") return problem
  return (clean as string[]).join("|")
}

function safePath(value: string): string | { error: string } {
  if (!value || /[|\r\n"]/.test(value)) return { error: "That path cannot be used." }
  return value
}

function plainPiece(value: string): boolean {
  return Boolean(value) && value !== "." && value !== ".." && !value.startsWith("-") && !/[|/\\"\r\n]/.test(value)
}
