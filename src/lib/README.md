# src/lib

entrypoints から利用する共有モジュールの置き場です。

- messaging / storage は後続 Issue で実装予定
- 依存方向は `entrypoints → lib` のみ許可。`lib` から `entrypoints` への import は禁止
