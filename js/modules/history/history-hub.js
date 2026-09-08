function inventoryRows(snaps, market = 'all') {
    const base = [];
    for (const s of snaps) {
      if (market === 'all' || market === 'amazon') {
        for (const r of getSnapshotAmazonRows(s) || []) {
          const [state, doc] = invState(r.inventory, r.avgDailyUnits || r.unitsPerDay || r.dailyUnits);
          base.push({
            Date: s.reportDate,
            Marketplace: 'Amazon',
            Category: r.category || '',
            'WF SKU': r.wfSku || '',
            'Marketplace SKU': r.azSku || '',
            'ASIN / FSN': r.asin || '',
            Inventory: r.inventory,
            'Avg Units / Day': r.avgDailyUnits || r.unitsPerDay || r.dailyUnits || '',
            'Days of Cover': doc == null ? '' : doc,
            'Inventory State': state
          });
        }
      }
      if (market === 'all' || market === 'flipkart') {
        for (const r of getSnapshotFlipkartRows(s) || []) {
          const [state, doc] = invState(r.inventory, r.avgDailyUnits || r.unitsPerDay || r.dailyUnits);
          base.push({
            Date: s.reportDate,
            Marketplace: 'Flipkart',
            Category: r.category || '',
            'WF SKU': r.wfSku || '',
            'Marketplace SKU': r.fkSku || '',
            'ASIN / FSN': r.fsn || '',
            Inventory: r.inventory,
            'Avg Units / Day': r.avgDailyUnits || r.unitsPerDay || r.dailyUnits || '',
            'Days of Cover': doc == null ? '' : doc,
            'Inventory State': state
          });
        }
      }
    }

    const g = new Map();
    for (const r of base) {
      const k = `${r.Marketplace}|${r['Marketplace SKU']}|${r['ASIN / FSN']}|${r['WF SKU']}`;
      (g.get(k) || g.set(k, []).get(k)).push(r);
    }

    for (const hist of g.values()) {
      hist.sort((a, b) => a.Date.localeCompare(b.Date));
      
      const totalUnits = hist.reduce((sum, x) => sum + Number(x['Avg Units / Day'] || 0), 0);
      const drr = Number((totalUnits / Math.max(1, hist.length)).toFixed(2));
      const opening = Number(hist[0]?.Inventory || 0);

      let prev = null;
      for (const r of hist) {
        r['DRR (Units/Day)'] = drr;
        const currentInv = Number(r.Inventory || 0);
        r['Inventory Depletion %'] = opening > 0 
          ? Number((Math.max(0, ((opening - currentInv) / opening) * 100)).toFixed(1)) 
          : 0;

        if (!prev) {
          r['Stock Movement'] = 'No Change';
        } else {
          const a = Number(prev.Inventory), b = Number(r.Inventory);
          r['Stock Movement'] = a <= 0 && b > 0 ? 'Restocked' 
                              : a > 0 && b <= 0 ? 'Became OOS' 
                              : b > a ? 'Stock Increased' 
                              : b < a ? 'Stock Decreased' 
                              : 'No Change';
        }
        prev = r;
      }
    }
    return base;
  }
