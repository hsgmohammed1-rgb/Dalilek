<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="2.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:sitemap="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:xhtml="http://www.w3.org/1999/xhtml"
  xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
<xsl:output method="html" indent="yes" encoding="UTF-8"/>
<xsl:template match="/">
<html dir="rtl" lang="ar">
<head>
  <title>خريطة الموقع — دليلك</title>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Segoe UI',Tahoma,sans-serif;background:#0a0e17;color:#e0e0e0;min-height:100vh}
    .header{background:linear-gradient(135deg,#0d1b2a 0%,#1b2a4a 50%,#0d1b2a 100%);padding:40px 20px;text-align:center;border-bottom:2px solid #00e6c8}
    .header h1{font-size:2.2em;background:linear-gradient(135deg,#00e6c8,#00b4d8);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;margin-bottom:8px}
    .header p{color:#8899aa;font-size:1.1em}
    .header .badge{display:inline-block;background:linear-gradient(135deg,#00e6c8,#00b4d8);color:#0a0e17;padding:6px 18px;border-radius:20px;font-weight:700;font-size:0.9em;margin-top:12px}
    .container{max-width:1200px;margin:0 auto;padding:20px}
    .stats{display:flex;gap:15px;margin:20px 0;flex-wrap:wrap;justify-content:center}
    .stat-box{background:linear-gradient(135deg,#111827,#1a2332);border:1px solid #1e3a5f;border-radius:12px;padding:16px 24px;text-align:center;min-width:140px}
    .stat-box .num{font-size:1.8em;font-weight:800;background:linear-gradient(135deg,#00e6c8,#00b4d8);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
    .stat-box .label{color:#6b7b8d;font-size:0.85em;margin-top:4px}
    table{width:100%;border-collapse:separate;border-spacing:0;margin:20px 0;background:#111827;border-radius:12px;overflow:hidden;border:1px solid #1e3a5f}
    th{background:linear-gradient(135deg,#0d2137,#162d50);color:#00e6c8;padding:14px 16px;text-align:right;font-weight:600;font-size:0.9em;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #00e6c8}
    td{padding:12px 16px;border-bottom:1px solid #1a2332;font-size:0.9em;transition:background 0.2s}
    tr:hover td{background:#0d1f35}
    tr:last-child td{border-bottom:none}
    a{color:#00e6c8;text-decoration:none;transition:color 0.2s;word-break:break-all}
    a:hover{color:#00f5d4;text-decoration:underline}
    .priority-high{color:#00e6c8;font-weight:700}
    .priority-med{color:#fbbf24;font-weight:600}
    .priority-low{color:#6b7b8d}
    .freq{display:inline-block;padding:3px 10px;border-radius:6px;font-size:0.8em;font-weight:600}
    .freq-daily{background:#0d3331;color:#00e6c8;border:1px solid #00e6c8}
    .freq-weekly{background:#2d2a0d;color:#fbbf24;border:1px solid #fbbf24}
    .freq-monthly{background:#1a1a2e;color:#7c7cf5;border:1px solid #7c7cf5}
    .freq-yearly{background:#1a1a1a;color:#888;border:1px solid #555}
    .lang-tags{display:flex;gap:4px;flex-wrap:wrap}
    .lang-tag{display:inline-block;padding:2px 8px;border-radius:4px;font-size:0.75em;font-weight:600;background:#1a2332;border:1px solid #2a3a4f;color:#8899aa}
    .lang-tag.active{background:#0d3331;border-color:#00e6c8;color:#00e6c8}
    .footer{text-align:center;padding:30px;color:#4a5568;font-size:0.9em;border-top:1px solid #1e3a5f;margin-top:30px}
    .footer a{color:#00e6c8}
    @media(max-width:768px){
      .header h1{font-size:1.5em}
      table{font-size:0.8em}
      td,th{padding:8px 10px}
      .stats{flex-direction:column;align-items:center}
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>🧭 دليلك — خريطة الموقع</h1>
    <p>Dalilek Sitemap — الموسوعة العربية الشاملة</p>
    <div class="badge">
      <xsl:value-of select="count(sitemap:urlset/sitemap:url)"/> صفحة
    </div>
  </div>
  <div class="container">
    <div class="stats">
      <div class="stat-box">
        <div class="num"><xsl:value-of select="count(sitemap:urlset/sitemap:url)"/></div>
        <div class="label">إجمالي الصفحات</div>
      </div>
      <div class="stat-box">
        <div class="num"><xsl:value-of select="count(sitemap:urlset/sitemap:url[sitemap:changefreq='daily'])"/></div>
        <div class="label">يومي</div>
      </div>
      <div class="stat-box">
        <div class="num"><xsl:value-of select="count(sitemap:urlset/sitemap:url[sitemap:changefreq='weekly'])"/></div>
        <div class="label">أسبوعي</div>
      </div>
      <div class="stat-box">
        <div class="num"><xsl:value-of select="count(sitemap:urlset/sitemap:url[contains(sitemap:loc,'/articles/')])"/></div>
        <div class="label">مقالات</div>
      </div>
    </div>
    <table>
      <thead>
        <tr>
          <th style="width:5%">#</th>
          <th style="width:45%">الرابط</th>
          <th style="width:12%">الأولوية</th>
          <th style="width:12%">التكرار</th>
          <th style="width:12%">آخر تحديث</th>
          <th style="width:14%">اللغات</th>
        </tr>
      </thead>
      <tbody>
        <xsl:for-each select="sitemap:urlset/sitemap:url">
          <tr>
            <td style="color:#4a5568;text-align:center"><xsl:value-of select="position()"/></td>
            <td>
              <a href="{sitemap:loc}"><xsl:value-of select="sitemap:loc"/></a>
            </td>
            <td style="text-align:center">
              <xsl:choose>
                <xsl:when test="sitemap:priority &gt;= 0.8">
                  <span class="priority-high"><xsl:value-of select="sitemap:priority"/></span>
                </xsl:when>
                <xsl:when test="sitemap:priority &gt;= 0.5">
                  <span class="priority-med"><xsl:value-of select="sitemap:priority"/></span>
                </xsl:when>
                <xsl:otherwise>
                  <span class="priority-low"><xsl:value-of select="sitemap:priority"/></span>
                </xsl:otherwise>
              </xsl:choose>
            </td>
            <td style="text-align:center">
              <xsl:choose>
                <xsl:when test="sitemap:changefreq='daily'"><span class="freq freq-daily">يومي</span></xsl:when>
                <xsl:when test="sitemap:changefreq='weekly'"><span class="freq freq-weekly">أسبوعي</span></xsl:when>
                <xsl:when test="sitemap:changefreq='monthly'"><span class="freq freq-monthly">شهري</span></xsl:when>
                <xsl:when test="sitemap:changefreq='yearly'"><span class="freq freq-yearly">سنوي</span></xsl:when>
                <xsl:otherwise><span class="freq"><xsl:value-of select="sitemap:changefreq"/></span></xsl:otherwise>
              </xsl:choose>
            </td>
            <td style="text-align:center;color:#6b7b8d"><xsl:value-of select="sitemap:lastmod"/></td>
            <td>
              <div class="lang-tags">
                <xsl:for-each select="xhtml:link[@rel='alternate']">
                  <xsl:if test="@hreflang != 'x-default'">
                    <a href="{@href}" class="lang-tag" title="{@href}">
                      <xsl:value-of select="@hreflang"/>
                    </a>
                  </xsl:if>
                </xsl:for-each>
              </div>
            </td>
          </tr>
        </xsl:for-each>
      </tbody>
    </table>
  </div>
  <div class="footer">
    <p>🧭 <a href="https://dalilek.online">دليلك — الموسوعة العربية الشاملة</a></p>
    <p style="margin-top:8px">هذه خريطة الموقع بتنسيق XML لمحركات البحث مثل Google و Bing</p>
  </div>
</body>
</html>
</xsl:template>
</xsl:stylesheet>
