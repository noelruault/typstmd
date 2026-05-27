# Table sizing debug

Each table targets one failure mode. Watch for: column overlap, text
spilling into neighbour, table overflowing right margin, starved (~0
width) columns.

## 1. All short (no wide → `columns: N`)

| A | B | C |
|---|---|---|
| 1 | 2 | 3 |
| x | y | z |

## 2. One wide prose column

| Key | Description |
|-----|-------------|
| timeout | The maximum duration to wait before the request is aborted and an error returned to the caller |
| retries | Number of attempts |

## 3. The original failing case (5 cols, long tokens)

| Branch | Verdict | Commit | Bench file (new) | Config flag |
|--------|---------|--------|------------------|-------------|
| research/0-bench-baseline | OURS WINS | 34ca2a2 | none | none |
| research/2-soft-ttl | OURS WINS | 82be6bb | none (existing bench_soft_ttl_test.go) | softWindow (pre-existing) |
| research/3-singleflight-invalidation | OURS WINS | 6a8961e | none (existing chaos_singleflight_test) | none |
| research/7-scale-on-backlog | OURS WINS | 155848c | none (existing bench_backlog_saturation) | TF target_value (pre-existing) |

## 4. Many columns, all medium

| One | Two | Three | Four | Five | Six | Seven |
|-----|-----|-------|------|------|-----|-------|
| alpha | beta | gamma | delta | epsilon | zeta | eta |
| 100 | 200 | 300 | 400 | 500 | 600 | 700 |

## 5. Single very long unbreakable token

| Identifier | Note |
|------------|------|
| supercalifragilisticexpialidocious_internal_cache_eviction_subsystem_handler | short |
| short | ok |

## 6. Two wide prose columns competing

| Problem | Resolution |
|---------|------------|
| The connection pool exhausts under sustained load because idle connections are never reclaimed | Add a background reaper that closes connections idle longer than the configured max-idle interval and emits a gauge |

## 7. All columns wide

| First long heading here | Second long heading here | Third long heading here |
|-------------------------|--------------------------|-------------------------|
| lorem ipsum dolor sit amet consectetur | adipiscing elit sed do eiusmod tempor | incididunt ut labore et dolore magna |

## 8. Mixed: short label + hash + long path + prose

| Status | SHA | Path | Summary |
|--------|-----|------|---------|
| OK | a3d621c | internal/cache/eviction/manager_test.go | Validates eviction under concurrent invalidation with singleflight dedupe |
| FAIL | 1e008aa | cmd/server/main.go | Boot |

## 9. Empty cells mixed with wide

| Col A | Col B | Col C |
|-------|-------|-------|
| | this column has a fairly long description that should wrap nicely | |
| value | | other |

## 10. Just at threshold boundary (~40 chars)

| Exactly forty chars in this cell here ok! | Short |
|-------------------------------------------|-------|
| data | x |

| Manager | items | M3 baseline B/row | c8g.large B/row | Drift | Verdict |
|---------|-------|-------------------|--------------------|-------|---------|
| BookingChannel | 50 | 313.0 | -449.0 | - | n/a (items<100, below measurement floor) |
| Chain | 5000 | 226.8 | 219.0 | -3.4% | ok |
| City | 50000 | 525.9 | 525.0 | -0.2% | ok |
| Country | 250 | 436.1 | 262.3 | -39.9% | improved |
| Customer | 50000 | 310.0 | 309.0 | -0.3% | ok |
| CustomerAllowRights | 50000 | 177.8 | 177.0 | -0.4% | ok |
| CustomerCancellationBuffer | 5000 | 207.1 | 198.9 | -4.0% | ok |
| CustomerCreditLine | 50000 | 189.9 | 189.0 | -0.5% | ok |
| Hotel | 50000 | 509.9 | 509.0 | -0.2% | ok |
