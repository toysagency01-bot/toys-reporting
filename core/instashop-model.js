(function(root, factory){
  const api = factory();
  if(typeof module === 'object' && module.exports) module.exports = api;
  else root.InstashopModel = api;
})(typeof self !== 'undefined' ? self : this, function(){
  function cellValue(cell){
    return cell && cell.v != null ? cell.v : '';
  }

  function cellDate(cell){
    if(!cell) return '';
    const value = cell.v;
    if(typeof value === 'string' && value.indexOf('Date(') === 0){
      const parts = value.slice(5, -1).split(',').map(Number);
      return parts[0] + '-' + String(parts[1] + 1).padStart(2, '0') + '-' + String(parts[2]).padStart(2, '0');
    }
    if(cell.f && /\d{4}-\d{2}-\d{2}/.test(cell.f)) return cell.f.match(/\d{4}-\d{2}-\d{2}/)[0];
    const text = String(value || '').slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : '';
  }

  function number(cell){
    const value = Number(cellValue(cell));
    return isFinite(value) ? value : 0;
  }

  function labelMap(json){
    const cols = json && json.table && json.table.cols || [];
    const map = {};
    cols.forEach(function(col, index){
      const key = String(col && col.label || '').trim().toLowerCase();
      if(key) map[key] = index;
    });
    return map;
  }

  function parseMeta(json){
    const map = labelMap(json);
    const required = ['date','platform','account_name','account_id','currency','campaign','impressions','clicks','cost','conversions'];
    if(required.some(function(key){ return map[key] == null; })) return [];
    const rows = json && json.table && json.table.rows || [];
    return rows.map(function(row){
      const c = row.c || [];
      const date = cellDate(c[map.date]);
      if(!date) return null;
      return {
        date: date,
        platform: String(cellValue(c[map.platform]) || 'Meta Ads'),
        account: String(cellValue(c[map.account_name]) || ''),
        accountId: String(cellValue(c[map.account_id]) || ''),
        currency: String(cellValue(c[map.currency]) || 'UAH'),
        campaign: String(cellValue(c[map.campaign]) || '(без названия)'),
        impressions: number(c[map.impressions]),
        clicks: number(c[map.clicks]),
        spendUah: number(c[map.cost]),
        metaDirect: map.meta_direct_inquiries == null ? number(c[map.conversions]) : number(c[map.meta_direct_inquiries]),
        spendUsd: map.spend_usd == null ? 0 : number(c[map.spend_usd]),
        fx: map.fx_usd_uah == null ? 0 : number(c[map.fx_usd_uah]),
      };
    }).filter(Boolean);
  }

  function parseSales(json){
    const map = labelMap(json);
    const required = ['date','qualified_inquiries','unqualified_inquiries','direct_inquiries','sales','revenue_uah'];
    if(required.some(function(key){ return map[key] == null; })) return [];
    const rows = json && json.table && json.table.rows || [];
    return rows.map(function(row){
      const c = row.c || [];
      const date = cellDate(c[map.date]);
      if(!date) return null;
      return {
        date: date,
        qualified: number(c[map.qualified_inquiries]),
        unqualified: number(c[map.unqualified_inquiries]),
        direct: number(c[map.direct_inquiries]),
        sales: number(c[map.sales]),
        revenue: number(c[map.revenue_uah]),
      };
    }).filter(Boolean);
  }

  function isoRange(from, to){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(from || '') || !/^\d{4}-\d{2}-\d{2}$/.test(to || '')) return [];
    const result = [];
    let cursor = Date.parse(from + 'T00:00:00Z');
    const end = Date.parse(to + 'T00:00:00Z');
    if(!isFinite(cursor) || !isFinite(end) || cursor > end) return result;
    while(cursor <= end){
      result.push(new Date(cursor).toISOString().slice(0,10));
      cursor += 86400000;
    }
    return result;
  }

  function sum(rows, key){
    return rows.reduce(function(total, row){ return total + (+row[key] || 0); }, 0);
  }

  function summarize(metaRows, salesRows){
    const spend = sum(metaRows, 'spendUah');
    const impressions = sum(metaRows, 'impressions');
    const clicks = sum(metaRows, 'clicks');
    const metaDirect = sum(metaRows, 'metaDirect');
    const direct = sum(salesRows, 'direct');
    const qualified = sum(salesRows, 'qualified');
    const unqualified = sum(salesRows, 'unqualified');
    const sales = sum(salesRows, 'sales');
    const revenue = sum(salesRows, 'revenue');
    return {
      spend: spend,
      impressions: impressions,
      clicks: clicks,
      metaDirect: metaDirect,
      direct: direct,
      qualified: qualified,
      unqualified: unqualified,
      sales: sales,
      revenue: revenue,
      ctr: impressions ? clicks / impressions : null,
      roas: spend ? revenue / spend : null,
      costPerDirect: direct ? spend / direct : null,
      costPerQualified: qualified ? spend / qualified : null,
      costPerSale: sales ? spend / sales : null,
      directToQualified: direct ? qualified / direct : null,
      qualifiedToSale: qualified ? sales / qualified : null,
    };
  }

  function campaignKey(row){
    return [row.accountId, row.campaign].map(function(v){ return String(v || '').trim().toLowerCase(); }).join('||');
  }

  function activeCampaignKeys(allRows, latestDate, days){
    const cutoff = new Date(latestDate + 'T00:00:00Z');
    cutoff.setUTCDate(cutoff.getUTCDate() - days);
    const cutoffIso = cutoff.toISOString().slice(0,10);
    const active = {};
    allRows.forEach(function(row){
      if(row.date >= cutoffIso && (row.impressions || row.clicks || row.spendUah || row.metaDirect)) active[campaignKey(row)] = true;
    });
    return active;
  }

  function aggregateCampaigns(periodRows, allRows, latestDate){
    const active = activeCampaignKeys(allRows, latestDate, 30);
    const grouped = {};
    periodRows.forEach(function(row){
      const key = campaignKey(row);
      if(!active[key]) return;
      const item = grouped[key] || (grouped[key] = {
        account: row.account,
        accountId: row.accountId,
        campaign: row.campaign,
        impressions: 0,
        clicks: 0,
        spendUah: 0,
        metaDirect: 0,
      });
      item.impressions += row.impressions;
      item.clicks += row.clicks;
      item.spendUah += row.spendUah;
      item.metaDirect += row.metaDirect;
    });
    return Object.keys(grouped).map(function(key){ return grouped[key]; }).sort(function(a,b){ return b.spendUah - a.spendUah; });
  }

  function dailySeries(dates, metaRows, salesRows){
    return dates.map(function(date){
      const meta = metaRows.filter(function(row){ return row.date === date; });
      const sales = salesRows.filter(function(row){ return row.date === date; });
      const summary = summarize(meta, sales);
      summary.date = date;
      return summary;
    });
  }

  return {
    parseMeta: parseMeta,
    parseSales: parseSales,
    isoRange: isoRange,
    summarize: summarize,
    aggregateCampaigns: aggregateCampaigns,
    dailySeries: dailySeries,
  };
});
