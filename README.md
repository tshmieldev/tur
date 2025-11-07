# tur (C++ ports)

This workspace contains C++ ports of `parse.ts` and `run.ts`.

Files:
- `parse.cpp` - parser that reads a `.rec` source file and produces a simple AST JSON.
- `run.cpp` - runtime that reads the AST JSON and executes a subset of commands.

Usage (build and run):

```bash
g++ -std=c++17 parse.cpp -o parse
g++ -std=c++17 run.cpp -o run

./parse [-d|--dump] [-l|--loud] <source-file>
# when -d is passed, parser writes <source-file>-ast.json

./run <ast-file.json>
```

Notes:
- The parser is a minimal port and enforces some argument rules; some existing `.rec` files in the repo may fail to parse if they use commands the parser expects different argument counts for.
- The runtime implements a subset of functions from the original `run.ts` (arithmetic, print, set/get, goto/if/return/read). It uses a small JSON reader tailored to the parser output.
- If you prefer robust JSON parsing in C++, we can switch to `nlohmann/json` (requires adding the single-header include or package).

Next steps you might want:
- Extend the runtime to support more commands ($randInt, $catFact, etc.)
- Improve parser error messages and permissiveness to match the TypeScript version exactly.
