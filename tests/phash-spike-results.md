# CatDex pHash Spike Results — 2026-07-28

## Verdict: pHash IS NOT VIABLE for cat re-identification

### Test data
- 11 photos of the SAME cat (different poses, angles, lighting)
- 8 photos of DIFFERENT cats

### Results

| Metric | Same-cat (should match) | Diff-cat (should differ) |
|--------|------------------------|--------------------------|
| Mean similarity | 52.2% | 52.6% |
| Median similarity | 53.1% | 50.0% |
| Max similarity | 65.6% | 65.6% |
| Min similarity | 37.5% | 40.6% |
| Std dev | ~6.5% | ~7.8% |

### Distributions overlap almost perfectly

The same-cat and diff-cat distributions are statistically indistinguishable.
No threshold can separate them with acceptable TPR/FPR.

Best achievable: TPR 40% @ FPR 36% (threshold 55%) — worse than a coin flip.

### Root cause

pHash (DCT-based) detects "same image recom pressed/resized", NOT "same object
in different pose/angle/lighting". For deformable objects like cats, the
perceptual hash of a lying-down photo is as different from a standing photo
as it is from a completely different cat.

### Decision

pHash stored in DB for future use (MobileNet v1.1) but NOT used for matching.
Capture flow is **manual-first**: user always picks existing cat or creates new.

### Generated hashes (for reference)

Same-cat hashes: dbcc06..., 6691c9..., 82373e..., 65c4cb..., fef1d1...,
  abeb21..., 2a966b..., a0033e..., 7fb9fb..., c1427f..., 342f8c...

Diff-cat hashes: a75b19..., 0e3b0b..., 2232b1..., 829219..., b7b7b6...,
  22331b..., 646ddd..., 492e36...
