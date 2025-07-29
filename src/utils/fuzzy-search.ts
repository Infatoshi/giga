interface FuzzyMatch {
  item: any;
  score: number;
  matches: number[];
}

/**
 * Simple fuzzy matching algorithm that scores matches based on:
 * - Exact matches get highest score
 * - Sequential character matches get high score
 * - Character matches get base score
 * - Shorter strings with matches get bonus points
 */
export function fuzzyMatch(query: string, target: string): FuzzyMatch | null {
  if (!query || !target) return null;
  
  const lowerQuery = query.toLowerCase();
  const lowerTarget = target.toLowerCase();
  
  // Exact match gets maximum score
  if (lowerTarget === lowerQuery) {
    return {
      item: target,
      score: 1000,
      matches: Array.from({ length: target.length }, (_, i) => i)
    };
  }
  
  // If target starts with query, give it high score
  if (lowerTarget.startsWith(lowerQuery)) {
    return {
      item: target,
      score: 900,
      matches: Array.from({ length: lowerQuery.length }, (_, i) => i)
    };
  }
  
  const matches: number[] = [];
  let queryIndex = 0;
  let score = 0;
  let consecutiveMatches = 0;
  
  for (let i = 0; i < lowerTarget.length && queryIndex < lowerQuery.length; i++) {
    if (lowerTarget[i] === lowerQuery[queryIndex]) {
      matches.push(i);
      queryIndex++;
      consecutiveMatches++;
      
      // Base score for each match
      score += 10;
      
      // Bonus for consecutive matches
      if (consecutiveMatches > 1) {
        score += consecutiveMatches * 5;
      }
      
      // Bonus for matches at the beginning
      if (i === queryIndex - 1) {
        score += 20;
      }
    } else {
      consecutiveMatches = 0;
    }
  }
  
  // If we didn't match all query characters, no match
  if (queryIndex < lowerQuery.length) {
    return null;
  }
  
  // Bonus for shorter targets (more relevant)
  const lengthBonus = Math.max(0, 100 - target.length);
  score += lengthBonus;
  
  return {
    item: target,
    score,
    matches
  };
}

export function fuzzySearch<T>(
  query: string,
  items: T[],
  getText: (item: T) => string,
  limit = 10
): T[] {
  if (!query.trim()) {
    return items.slice(0, limit);
  }
  
  const matches: Array<{ item: T; score: number }> = [];
  
  for (const item of items) {
    const text = getText(item);
    const match = fuzzyMatch(query, text);
    
    if (match) {
      matches.push({ item, score: match.score });
    }
  }
  
  // Sort by score (descending) and return items
  return matches
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(match => match.item);
}