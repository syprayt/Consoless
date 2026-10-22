import type { CategoryId } from "./taxonomy"

export type KnownCommand = {
  title: string
  summary: string
  category: CategoryId
  blocked?: boolean
  interactive?: boolean
  note?: string
}

function k(
  title: string,
  summary: string,
  category: CategoryId,
  extra?: Partial<Omit<KnownCommand, "title" | "summary" | "category">>,
): KnownCommand {
  return { title, summary, category, ...extra }
}

const noRun = "There is no run button. This command changes the system."

export const KNOWN: Record<string, KnownCommand> = {
  ifconfig: k("Network interfaces", "Shows adapters and their IP addresses", "network"),
  ipconfig: k("Mac network service", "Service details for this Mac's network", "network"),
  ping: k("Check a connection", "Checks whether an address answers", "network"),
  curl: k("Web request", "Opens an address and shows the response", "network"),
  wget: k("Fetch a URL", "Reads a page or file at an address", "network"),
  ssh: k("Remote login", "Connects to another computer", "network", { interactive: true }),
  scp: k("Copy over the network", "Copies files to another computer", "network", { interactive: true }),
  sftp: k("Files over the network", "Exchanges files with another computer", "network", { interactive: true }),
  dig: k("DNS lookup", "Finds the address behind a site name", "network"),
  nslookup: k("Find an address", "Asks DNS for a site's address", "network"),
  host: k("Name and address", "Translates a site name to an address and back", "network"),
  traceroute: k("Route", "Shows the hops a packet takes", "network"),
  nc: k("Network channel", "Opens a simple network connection", "network"),
  netstat: k("Connections", "Who is connected to this Mac", "network"),
  arp: k("Nearby devices", "Devices this Mac has seen on the local network", "network"),
  route: k("Routes", "Where this Mac sends network traffic", "network"),
  networksetup: k("Network settings", "Ports, Wi-Fi, and macOS network services", "network"),

  ls: k("Folder contents", "Lists the files in a folder", "files"),
  mkdir: k("New folder", "Creates a folder", "files"),
  rm: k("Delete", "Removes files you pick. This skips the Trash", "files"),
  rmdir: k("Remove empty folder", "Removes a folder that has nothing inside", "files"),
  cp: k("Copy", "Copies files into a folder you pick", "files"),
  mv: k("Move", "Moves files into a folder you pick", "files"),
  touch: k("New file", "Creates an empty file or updates its date", "files"),
  open: k("Open", "Opens a file or folder in a Mac app", "files"),
  find: k("Find files", "Searches folders for files", "files"),
  mdfind: k("Spotlight search", "Searches this Mac the way Spotlight does", "files"),
  du: k("Folder size", "Measures how much space folders use", "files"),
  df: k("Free space", "Shows how much space is left on disks", "files"),
  chmod: k("Permissions", "Who can read and change a file", "files", { blocked: true, note: noRun }),
  chown: k("Owner", "Changes who owns a file", "files", { blocked: true, note: noRun }),
  ln: k("Link", "Gives a file another name", "files"),
  pwd: k("Current folder", "Shows the folder you are in", "files"),
  cd: k("Go to folder", "Opens another folder", "files"),
  stat: k("File details", "Size, dates, and permissions of one file", "files"),
  file: k("File type", "Tells what kind of data is in a file", "files"),
  rsync: k("Sync", "Copies folders and updates only what changed", "files", { blocked: true, note: noRun }),

  cat: k("Show a file", "Shows the contents of a file you pick", "text"),
  grep: k("Find in text", "Searches for a line inside files", "text"),
  less: k("Read page by page", "Opens a long text one screen at a time", "text", { interactive: true }),
  more: k("Page through text", "Shows text in chunks", "text", { interactive: true }),
  head: k("Start of a file", "The first lines of a file", "text"),
  tail: k("End of a file", "The last lines of a file", "text"),
  sort: k("Sort", "Puts lines in alphabetical order", "text"),
  uniq: k("Skip repeats", "Drops neighboring identical lines", "text"),
  diff: k("Compare", "Shows how two files differ", "text"),
  wc: k("Count", "Counts lines, words, and characters", "text"),
  sed: k("Replace in text", "Changes text by a rule", "text"),
  awk: k("Parse text", "Pulls columns out of lines", "text"),
  cut: k("Cut columns", "Keeps one slice of each line", "text"),
  tr: k("Replace characters", "Swaps one set of characters for another", "text"),
  man: k("Manual", "The description page for a command", "text", { interactive: true }),

  ps: k("Processes", "What is running right now", "system"),
  top: k("Load", "A snapshot of processes and load", "system"),
  htop: k("Load", "A live process list", "system", { interactive: true }),
  kill: k("Stop a process", "Ends a program by its number", "system", { blocked: true, note: noRun }),
  killall: k("Stop by name", "Ends programs with this name", "system", { blocked: true, note: noRun }),
  sudo: k("Run as administrator", "Runs a command with extra privileges", "system", { blocked: true, note: noRun }),
  shutdown: k("Shut down", "Turns the computer off", "system", { blocked: true, note: noRun }),
  reboot: k("Restart", "Restarts the computer", "system", { blocked: true, note: noRun }),
  diskutil: k("Disks", "Partitions and volumes on this Mac", "system", { blocked: true, note: noRun }),
  uname: k("About this system", "System name and processor type", "system"),
  sw_vers: k("macOS version", "Which version of macOS is installed", "system"),
  whoami: k("Who am I", "The name of the current account", "system"),
  id: k("Account", "User id and groups", "system"),
  date: k("Date and time", "The current date and time", "system"),
  uptime: k("Uptime", "How long the computer has been on", "system"),
  hostname: k("Computer name", "What this Mac is called on the network", "system"),
  softwareupdate: k("Updates", "Checks for macOS updates", "system"),
  pmset: k("Power", "Sleep, battery, and energy settings", "system"),

  git: k("Git", "History of changes in a project", "dev"),
  node: k("Node.js", "The JavaScript runtime", "dev"),
  npm: k("npm packages", "The JavaScript package manager", "dev"),
  npx: k("Run an npm package", "Runs a package from npm", "dev"),
  python: k("Python", "The Python language", "dev"),
  python3: k("Python", "The Python language", "dev"),
  pip3: k("Python packages", "Installs Python libraries", "packages"),
  docker: k("Docker", "Containers for programs", "dev"),
  vim: k("Vim", "A full-screen text editor", "dev", { interactive: true }),
  nvim: k("Neovim", "A full-screen text editor", "dev", { interactive: true }),
  nano: k("Nano", "A simple text editor", "dev", { interactive: true }),
  code: k("Code editor", "Opens Visual Studio Code", "dev"),
  cursor: k("Cursor", "Opens the Cursor editor", "dev"),
  make: k("Build", "Builds a project from a Makefile", "dev"),
  clang: k("C compiler", "Builds C and C++ programs", "dev"),
  gcc: k("C compiler", "Builds C and C++ programs", "dev"),
  go: k("Go", "The Go language", "dev"),
  cargo: k("Cargo", "Builds Rust projects", "dev"),
  ruby: k("Ruby", "The Ruby language", "dev"),
  perl: k("Perl", "The Perl language", "dev"),
  adb: k("Android", "Talks to an Android phone", "dev"),
  gh: k("GitHub", "Commands for GitHub", "dev"),

  brew: k("Homebrew", "Installs programs on a Mac", "packages"),
  mas: k("App Store", "Commands for the Mac App Store", "packages"),

  tar: k("tar archive", "Packs files into one archive", "archive"),
  zip: k("zip archive", "Packs files into a zip", "archive"),
  unzip: k("Unzip", "Extracts files from a zip", "archive"),
  gzip: k("Compress", "Shrinks a file", "archive"),
  gunzip: k("Decompress", "Restores a compressed file", "archive"),
  bzip2: k("bzip compress", "Shrinks a file with bzip2", "archive"),

  say: k("Speak", "The Mac reads a phrase aloud", "media"),
  afplay: k("Play audio", "Plays a sound file", "media"),
  screencapture: k("Screenshot", "Takes a picture of the screen", "media"),
  sips: k("Image", "Inspects and changes pictures", "media"),

  echo: k("Print", "Prints text", "shell"),
  alias: k("Shortcuts", "Short names for commands", "shell"),
  history: k("History", "Commands that were typed before", "shell"),
  export: k("Variables", "Sets a value for programs", "shell"),
  source: k("Read settings", "Runs a file of shell commands", "shell"),
  pushd: k("Remember folder", "Goes to a folder and remembers the previous one", "shell"),
  popd: k("Go back", "Returns to a remembered folder", "shell"),
  which: k("Where is it", "Finds a program file by name", "shell"),
  printenv: k("Environment", "Shows environment settings", "shell"),
  pbcopy: k("Copy text", "Puts text on the clipboard", "shell", {
    blocked: true,
    note: "There is no button, so copied text is not overwritten by accident.",
  }),
  pbpaste: k("Paste", "Shows text from the clipboard", "shell", {
    blocked: true,
    note: "There is no button, so passwords on the clipboard stay hidden.",
  }),
}
