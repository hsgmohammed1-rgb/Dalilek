import sys, os, re
sys.stdout.reconfigure(encoding='utf-8')

fpath = 'C:\\Users\\MOH\\Documents\\GG\\Dalilek-master\\assets\\index-CdSb2jcH.v3.js'
with open(fpath, 'r', encoding='utf-8') as f:
    content = f.read()

# The social media section to insert
# Using the same style as the newsletter section (fI)
# With inline SVG icons for each platform

social_section = '''i.jsxs("section",{className:"py-10 sm:py-14",children:i.jsx("div",{className:"max-w-7xl mx-auto px-4 sm:px-6 lg:px-8",children:i.jsxs("div",{className:"relative overflow-hidden rounded-2xl sm:rounded-3xl border border-border shadow-sm",children:[i.jsx("div",{className:"absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-emerald-500/5"}),i.jsx("div",{className:"absolute -top-20 -right-20 w-60 h-60 bg-primary/10 rounded-full blur-3xl"}),i.jsx("div",{className:"absolute -bottom-20 -left-20 w-60 h-60 bg-emerald-500/10 rounded-full blur-3xl"}),i.jsxs("div",{className:"relative z-10 flex flex-col items-center text-center px-6 sm:px-12 py-8 sm:py-10",children:[i.jsxs("div",{className:"inline-flex items-center gap-2 px-4 py-1.5 bg-primary/10 border border-primary/20 text-primary text-sm font-bold rounded-full mb-4",children:[i.jsx("svg",{className:"w-4 h-4",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:i.jsx("path",{d:"M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z"})}),"تابعنا على"}),i.jsx("h2",{className:"text-2xl sm:text-3xl font-black text-foreground mb-2",children:i.jsx("span",{className:"bg-clip-text text-transparent bg-gradient-to-l from-primary to-emerald-500",children:"دليلك على وسائل التواصل"})}),i.jsx("p",{className:"text-muted-foreground text-sm mb-6 sm:mb-8",children:"انضم إلى آلاف المتابعين وتابع أحدث المقالات والنصائح الحصرية"}),i.jsxs("div",{className:"flex items-center justify-center gap-3 sm:gap-4 flex-wrap",children:['''

# Facebook
social_section += '''
i.jsxs("a",{href:"https://facebook.com/dalilek",target:"_blank",rel:"noopener noreferrer",className:"w-12 h-12 sm:w-14 sm:h-14 rounded-xl border border-blue-600/30 flex items-center justify-center hover:bg-[#1877F2] hover:text-white hover:scale-110 hover:-translate-y-1 transition-all duration-300 group",style:{background:"rgba(255,255,255,0.04)"},children:[i.jsx("svg",{className:"w-5 h-5 sm:w-6 sm:h-6 transition-colors",viewBox:"0 0 24 24",fill:"currentColor",children:i.jsx("path",{d:"M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"})})]},"Facebook"),'''

# Twitter/X
social_section += '''
i.jsxs("a",{href:"https://x.com/dalilek",target:"_blank",rel:"noopener noreferrer",className:"w-12 h-12 sm:w-14 sm:h-14 rounded-xl border border-sky-500/30 flex items-center justify-center hover:bg-black hover:text-white hover:scale-110 hover:-translate-y-1 transition-all duration-300 group",style:{background:"rgba(255,255,255,0.04)"},children:[i.jsx("svg",{className:"w-5 h-5 sm:w-6 sm:h-6 transition-colors",viewBox:"0 0 24 24",fill:"currentColor",children:i.jsx("path",{d:"M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"})})]},"X / Twitter"),'''

# Instagram
social_section += '''
i.jsxs("a",{href:"https://instagram.com/dalilek",target:"_blank",rel:"noopener noreferrer",className:"w-12 h-12 sm:w-14 sm:h-14 rounded-xl border border-pink-500/30 flex items-center justify-center hover:bg-gradient-to-tr hover:from-yellow-400 hover:via-pink-500 hover:to-purple-600 hover:text-white hover:scale-110 hover:-translate-y-1 transition-all duration-300 group",style:{background:"rgba(255,255,255,0.04)"},children:[i.jsx("svg",{className:"w-5 h-5 sm:w-6 sm:h-6 transition-colors",viewBox:"0 0 24 24",fill:"currentColor",children:i.jsx("path",{d:"M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"})})]},"Instagram"),'''

# YouTube
social_section += '''
i.jsxs("a",{href:"https://youtube.com/@dalilek",target:"_blank",rel:"noopener noreferrer",className:"w-12 h-12 sm:w-14 sm:h-14 rounded-xl border border-red-600/30 flex items-center justify-center hover:bg-[#FF0000] hover:text-white hover:scale-110 hover:-translate-y-1 transition-all duration-300 group",style:{background:"rgba(255,255,255,0.04)"},children:[i.jsx("svg",{className:"w-5 h-5 sm:w-6 sm:h-6 transition-colors",viewBox:"0 0 24 24",fill:"currentColor",children:i.jsx("path",{d:"M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"})})]},"YouTube"),'''

# LinkedIn
social_section += '''
i.jsxs("a",{href:"https://linkedin.com/company/dalilek",target:"_blank",rel:"noopener noreferrer",className:"w-12 h-12 sm:w-14 sm:h-14 rounded-xl border border-blue-700/30 flex items-center justify-center hover:bg-[#0A66C2] hover:text-white hover:scale-110 hover:-translate-y-1 transition-all duration-300 group",style:{background:"rgba(255,255,255,0.04)"},children:[i.jsx("svg",{className:"w-5 h-5 sm:w-6 sm:h-6 transition-colors",viewBox:"0 0 24 24",fill:"currentColor",children:i.jsx("path",{d:"M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"})})]},"LinkedIn")'''

social_section += '''
]})]})})})'''

# Now find and replace in the NI function
old = 'i.jsx(fI,{})]}),i.jsx(Gt,{})'
new = 'i.jsx(fI,{}),' + social_section + ']}),i.jsx(Gt,{})'

if old in content:
    content = content.replace(old, new, 1)
    with open(fpath, 'w', encoding='utf-8') as f:
        f.write(content)
    print('✅ Social section added successfully to v3.js')
else:
    print('❌ Could not find insertion point in v3.js')
    # Try to debug
    idx = content.find('i.jsx(fI,{})')
    if idx >= 0:
        print(f'Found fI at {idx}')
        print(repr(content[idx:idx+50]))
