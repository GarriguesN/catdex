# CatDex Spike 2 — MobileNet Embeddings Results

## Verdict: MobileNet (ImageNet) IS NOT VIABLE for cat re-identification

### Test data
Same 19 photos as Spike 1 (11 same-cat, 8 diff-cat).

### Model
MobileNet v2, alpha=0.50, embeddings from penultimate layer (1280-dim).

### Results

| Metric | Same-cat | Diff-cat | Cross-class |
|--------|----------|----------|-------------|
| Mean cos similarity | 98.7% | 97.7% | 98.1% |
| Min | 96.8% | 93.2% | 92.5% |
| Max | 99.7% | 99.4% | 99.7% |
| Std dev | 0.7% | 2.1% | - |

### Analysis

Separation between same-cat and diff-cat distributions: **1.0%** (worse than pHash's ~0%).

ALL cat photos — regardless of individual identity — produce embeddings with 
cosine similarity > 92%. MobileNet's penultimate layer encodes "cat-ness" 
(ImageNet class), not individual identity.

At ANY threshold, TPR = FPR = 100% because the distributions overlap completely.

### Root cause

MobileNet was trained on ImageNet to classify "cat vs not-cat", not to 
distinguish between individual cats. The embeddings capture generic feline 
features (ears, whiskers, eyes, fur texture) shared by ALL cats, not 
discriminative features that vary between individuals.

### What WOULD work (but doesn't exist for browser)

- **Wildbook / HotSpotter**: SIFT-based pattern matching for animal re-id 
  (zebras, whale sharks, giraffes). Research-grade, not browser-packaged.
- **Fine-tuned Siamese Network**: Would need thousands of labeled same/different 
  cat pairs + GPU training → server-side only.
- **Face recognition adapted to cats**: Possible with fine-tuning, but again 
  server-side and needs massive labeled dataset.

### Decision

**No auto-suggestion in v1.** Manual-first flow confirmed as the only viable 
approach without server-side ML.

pHash + embedding stored in DB for potential future use if a browser-compatible 
re-id model becomes available.
