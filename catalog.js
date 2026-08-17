const RepairDeskCatalog = (() => {
  const countries = [
    { code: "US", language: "en", currency: "USD" },
    { code: "RU", language: "ru", currency: "RUB" },
    { code: "UA", language: "uk", currency: "UAH" },
    { code: "DE", language: "de", currency: "EUR" },
    { code: "JP", language: "ja", currency: "JPY" },
    { code: "FR", language: "fr", currency: "EUR" },
    { code: "IT", language: "it", currency: "EUR" },
    { code: "ES", language: "es", currency: "EUR" },
    { code: "PT", language: "pt", currency: "EUR" },
    { code: "CN", language: "zh", currency: "CNY" },
    { code: "IN", language: "hi", currency: "INR" },
    { code: "SA", language: "ar", currency: "SAR" },
    { code: "BD", language: "bn", currency: "BDT" },
    { code: "TR", language: "tr", currency: "TRY" },
    { code: "KR", language: "ko", currency: "KRW" },
    { code: "ID", language: "id", currency: "IDR" },
    { code: "PL", language: "pl", currency: "PLN" },
    { code: "NL", language: "nl", currency: "EUR" },
    { code: "VN", language: "vi", currency: "VND" },
    { code: "TH", language: "th", currency: "THB" },
  ];

  const countryByCode = new Map(countries.map((country) => [country.code, country]));

  const providers = {
    US: [
      ["eBay", "ebay.com", "https://www.ebay.com/sch/i.html?_nkw={query}"],
      ["Amazon", "amazon.com", "https://www.amazon.com/s?k={query}"],
      ["iFixit", "ifixit.com", "https://www.ifixit.com/Search?query={query}"],
      ["Walmart", "walmart.com", "https://www.walmart.com/search?q={query}"],
    ],
    RU: [
      ["Яндекс Маркет", "market.yandex.ru", "https://market.yandex.ru/search?text={query}"],
      ["Ozon", "ozon.ru", "https://www.ozon.ru/search/?text={query}"],
      ["Avito", "avito.ru", "https://www.avito.ru/rossiya?q={query}"],
      ["AliExpress", "aliexpress.com", "https://www.aliexpress.com/w/wholesale-{query}.html"],
    ],
    UA: [
      ["Prom", "prom.ua", "https://prom.ua/ua/search?search_term={query}"],
      ["Rozetka", "rozetka.com.ua", "https://rozetka.com.ua/ua/search/?text={query}"],
      ["OLX", "olx.ua", "https://www.olx.ua/uk/list/q-{query}/"],
      ["Hotline", "hotline.ua", "https://hotline.ua/ua/sr/?q={query}"],
    ],
    DE: [
      ["eBay", "ebay.de", "https://www.ebay.de/sch/i.html?_nkw={query}"],
      ["Amazon", "amazon.de", "https://www.amazon.de/s?k={query}"],
      ["Kaufland", "kaufland.de", "https://www.kaufland.de/product-search/?search_value={query}"],
      ["Idealo", "idealo.de", "https://www.idealo.de/preisvergleich/MainSearchProductCategory.html?q={query}"],
    ],
    JP: [
      ["Rakuten", "search.rakuten.co.jp", "https://search.rakuten.co.jp/search/mall/{query}/"],
      ["Yahoo! Shopping", "shopping.yahoo.co.jp", "https://shopping.yahoo.co.jp/search?p={query}"],
      ["Amazon", "amazon.co.jp", "https://www.amazon.co.jp/s?k={query}"],
      ["Mercari", "jp.mercari.com", "https://jp.mercari.com/search?keyword={query}"],
    ],
    FR: [
      ["eBay", "ebay.fr", "https://www.ebay.fr/sch/i.html?_nkw={query}"],
      ["Amazon", "amazon.fr", "https://www.amazon.fr/s?k={query}"],
      ["Cdiscount", "cdiscount.com", "https://www.cdiscount.com/search/10/{query}.html"],
      ["Fnac", "fnac.com", "https://www.fnac.com/SearchResult/ResultList.aspx?Search={query}"],
    ],
    IT: [
      ["eBay", "ebay.it", "https://www.ebay.it/sch/i.html?_nkw={query}"],
      ["Amazon", "amazon.it", "https://www.amazon.it/s?k={query}"],
      ["Trovaprezzi", "trovaprezzi.it", "https://www.trovaprezzi.it/prezzo_{query}.aspx"],
      ["Subito", "subito.it", "https://www.subito.it/annunci-italia/vendita/usato/?q={query}"],
    ],
    ES: [
      ["eBay", "ebay.es", "https://www.ebay.es/sch/i.html?_nkw={query}"],
      ["Amazon", "amazon.es", "https://www.amazon.es/s?k={query}"],
      ["Wallapop", "es.wallapop.com", "https://es.wallapop.com/app/search?keywords={query}"],
      ["PcComponentes", "pccomponentes.com", "https://www.pccomponentes.com/buscar/?query={query}"],
    ],
    PT: [
      ["KuantoKusta", "kuantokusta.pt", "https://www.kuantokusta.pt/search?q={query}"],
      ["Worten", "worten.pt", "https://www.worten.pt/search?query={query}"],
      ["OLX", "olx.pt", "https://www.olx.pt/ads/q-{query}/"],
      ["Amazon ES", "amazon.es", "https://www.amazon.es/s?k={query}"],
    ],
    CN: [
      ["淘宝", "s.taobao.com", "https://s.taobao.com/search?q={query}"],
      ["京东", "search.jd.com", "https://search.jd.com/Search?keyword={query}"],
      ["1688", "s.1688.com", "https://s.1688.com/selloffer/offer_search.htm?keywords={query}"],
      ["AliExpress", "aliexpress.com", "https://www.aliexpress.com/w/wholesale-{query}.html"],
    ],
    IN: [
      ["Amazon", "amazon.in", "https://www.amazon.in/s?k={query}"],
      ["Flipkart", "flipkart.com", "https://www.flipkart.com/search?q={query}"],
      ["IndiaMART", "indiamart.com", "https://dir.indiamart.com/search.mp?ss={query}"],
      ["OLX", "olx.in", "https://www.olx.in/items/q-{query}"],
    ],
    SA: [
      ["Amazon", "amazon.sa", "https://www.amazon.sa/s?k={query}"],
      ["noon", "noon.com", "https://www.noon.com/saudi-en/search?q={query}"],
      ["Haraj", "haraj.com.sa", "https://haraj.com.sa/search/{query}/"],
      ["AliExpress", "aliexpress.com", "https://www.aliexpress.com/w/wholesale-{query}.html"],
    ],
    BD: [
      ["Daraz", "daraz.com.bd", "https://www.daraz.com.bd/catalog/?q={query}"],
      ["Bikroy", "bikroy.com", "https://bikroy.com/en/ads?query={query}"],
      ["Pickaboo", "pickaboo.com", "https://www.pickaboo.com/catalogsearch/result/?q={query}"],
      ["AliExpress", "aliexpress.com", "https://www.aliexpress.com/w/wholesale-{query}.html"],
    ],
    TR: [
      ["Trendyol", "trendyol.com", "https://www.trendyol.com/sr?q={query}"],
      ["Hepsiburada", "hepsiburada.com", "https://www.hepsiburada.com/ara?q={query}"],
      ["n11", "n11.com", "https://www.n11.com/arama?q={query}"],
      ["Sahibinden", "sahibinden.com", "https://www.sahibinden.com/arama?query_text={query}"],
    ],
    KR: [
      ["Coupang", "coupang.com", "https://www.coupang.com/np/search?q={query}"],
      ["Naver Shopping", "search.shopping.naver.com", "https://search.shopping.naver.com/search/all?query={query}"],
      ["Gmarket", "browse.gmarket.co.kr", "https://browse.gmarket.co.kr/search?keyword={query}"],
      ["11st", "search.11st.co.kr", "https://search.11st.co.kr/Search.tmall?kwd={query}"],
    ],
    ID: [
      ["Tokopedia", "tokopedia.com", "https://www.tokopedia.com/search?st=product&q={query}"],
      ["Shopee", "shopee.co.id", "https://shopee.co.id/search?keyword={query}"],
      ["Bukalapak", "bukalapak.com", "https://www.bukalapak.com/products?search%5Bkeywords%5D={query}"],
      ["Blibli", "blibli.com", "https://www.blibli.com/jual/{query}"],
    ],
    PL: [
      ["Allegro", "allegro.pl", "https://allegro.pl/listing?string={query}"],
      ["Ceneo", "ceneo.pl", "https://www.ceneo.pl/;szukaj-{query}"],
      ["OLX", "olx.pl", "https://www.olx.pl/oferty/q-{query}/"],
      ["Amazon", "amazon.pl", "https://www.amazon.pl/s?k={query}"],
    ],
    NL: [
      ["Marktplaats", "marktplaats.nl", "https://www.marktplaats.nl/q/{query}/"],
      ["bol", "bol.com", "https://www.bol.com/nl/nl/s/?searchtext={query}"],
      ["Tweakers", "tweakers.net", "https://tweakers.net/pricewatch/zoeken/?keyword={query}"],
      ["Amazon", "amazon.nl", "https://www.amazon.nl/s?k={query}"],
    ],
    VN: [
      ["Shopee", "shopee.vn", "https://shopee.vn/search?keyword={query}"],
      ["Lazada", "lazada.vn", "https://www.lazada.vn/catalog/?q={query}"],
      ["Tiki", "tiki.vn", "https://tiki.vn/search?q={query}"],
      ["Chợ Tốt", "chotot.com", "https://www.chotot.com/mua-ban?q={query}"],
    ],
    TH: [
      ["Shopee", "shopee.co.th", "https://shopee.co.th/search?keyword={query}"],
      ["Lazada", "lazada.co.th", "https://www.lazada.co.th/catalog/?q={query}"],
      ["Kaidee", "kaidee.com", "https://www.kaidee.com/s?q={query}"],
      ["Advice", "advice.co.th", "https://www.advice.co.th/search?keyword={query}"],
    ],
  };

  function providerList(countryCode) {
    return (providers[countryCode] || providers.US).map(([name, domain, url]) => ({ name, domain, url }));
  }

  function buildUrl(template, query) {
    return template.replaceAll("{query}", encodeURIComponent(query.trim()).replaceAll("%20", "+"));
  }

  function shoppingUrl(query, countryCode, language) {
    const code = countryByCode.has(countryCode) ? countryCode : "US";
    const lang = language || countryByCode.get(code)?.language || "en";
    const params = new URLSearchParams({ tbm: "shop", q: query.trim(), gl: code, hl: lang });
    return `https://www.google.com/search?${params.toString()}`;
  }

  function webSearchUrl(query, countryCode, language) {
    const code = countryByCode.has(countryCode) ? countryCode : "US";
    const lang = language || countryByCode.get(code)?.language || "en";
    const params = new URLSearchParams({ q: query.trim(), gl: code, hl: lang });
    return `https://www.google.com/search?${params.toString()}`;
  }

  function recommendedDomains(countryCode) {
    return [...new Set(providerList(countryCode).map((provider) => provider.domain))];
  }

  return {
    countries,
    countryByCode,
    providerList,
    buildUrl,
    shoppingUrl,
    webSearchUrl,
    recommendedDomains,
  };
})();
