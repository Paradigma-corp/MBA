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

  const activeCategories = categories
    .filter((category) => Array.isArray(category.records) && category.records.length > 0)
    .map((category) => ({
      base: category,
      margins: category.records.map((item) => Number(item.margen) || 0),
      length: category.records.length,
      results: new Float64Array(iterations),
    }));

  if (activeCategories.length === 0) {
    return categories.map((category) => ({ ...category, lower: category.margen, upper: category.margen }));
  }

  for (let i = 0; i < iterations; i += 1) {
    activeCategories.forEach((category) => {
      let sum = 0;
      for (let j = 0; j < category.length; j += 1) {
        const randomIndex = Math.floor(Math.random() * category.length);
        sum += category.margins[randomIndex];
      }
      category.results[i] = category.length ? sum / category.length : 0;
    });
  }

  return categories.map((category) => {
    const found = activeCategories.find((item) => item.base.name === category.name);
    if (!found) {
      return { ...category, lower: category.margen, upper: category.margen };
    }

    const sorted = Array.from(found.results).sort((a, b) => a - b);
    return {
      ...category,
      lower: percentile(sorted, lowerP),
      upper: percentile(sorted, upperP),
    };
  });
};
