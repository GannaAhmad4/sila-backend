
export const activationTemplate = (link, userName) => {
    return `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
        <meta charset="UTF-8">
        <style>
            .container {
                max-width: 600px;
                margin: 0 auto;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                border: 1px solid #e0e0e0;
                border-radius: 15px;
                overflow: hidden;
            }
            .header {
                background-color: #8a2be2; 
                color: white;
                padding: 20px;
                text-align: center;
            }
            .body {
                padding: 30px;
                text-align: right;
                line-height: 1.6;
                color: #333;
            }
            .btn {
                display: inline-block;
                padding: 12px 25px;
                background-color: #9b59b6;
                color: white !important;
                text-decoration: none;
                border-radius: 8px;
                font-weight: bold;
                margin-top: 20px;
            }
            .footer {
                background-color: #f9f9f9;
                padding: 15px;
                text-align: center;
                font-size: 12px;
                color: #777;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1 style="color: white; margin: 0;">منصة صلة 💜</h1>
            </div>
            <div class="body">
                <h2>أهلاً بك يا ${userName}،</h2>
                <p>سعداء جداً بانضمامك إلينا في رحلة دعم وتطوير أطفالنا. خطوة واحدة تفصلك عن تفعيل حسابك والبدء في استخدام المنصة.</p>
                <div style="text-align: center;">
                    <a href="${link}" class="btn">تفعيل الحساب الآن</a>
                </div>
                <p style="margin-top: 30px; font-size: 0.9em; color: #666;">إذا لم تكن أنت من قمت بإنشاء هذا الحساب، يرجى تجاهل هذا الإيميل.</p>
            </div>
            <div class="footer">
                <p>© 2026 صلة - معاً نصنع مستقبلاً أفضل لأطفالنا</p>
            </div>
        </div>
    </body>
    </html>
    `;
};