const percentile = (sortedArray, p) => {
  const idx = (sortedArray.length - 1) * p;
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (upper >= sortedArray.length) return sortedArray[lower];
  return sortedArray[lower] + (sortedArray[upper] - sortedArray[lower]) * (idx - lower);
};

const mean = (values) => values.reduce((acc, value) => acc + value, 0) / (values.length || 1);

export const performBootstrap = (categories, iterations = 1000, confidenceLevel = 0.95) => {
  const halfAlpha = (1 - confidenceLevel) / 2;
  const lowerP = halfAlpha;
  const upperP = 1 - halfAlpha;

  const results = categories.reduce((acc, category) => {
    acc[category.name] = [];
    return acc;
  }, {});

  for (let i = 0; i < iterations; i += 1) {
    categories.forEach((category) => {
      const sample = Array.from({ length: category.records.length }, () => {
        const randomIndex = Math.floor(Math.random() * category.records.length);
        return category.records[randomIndex];
      });
      const bootstrapMean = mean(sample.map((item) => Number(item.margen) || 0));
      results[category.name].push(bootstrapMean);
    });
  }

  return categories.map((category) => {
    const sorted = results[category.name].sort((a, b) => a - b);
    return {
      ...category,
      lower: percentile(sorted, lowerP),
      upper: percentile(sorted, upperP),
    };
  });
};
