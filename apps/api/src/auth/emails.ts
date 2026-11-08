import type { Locale } from '@faith/config';

type Strings = { subject: string; intro: string; action: string; ignore: string };
type Template = 'verify' | 'reset' | 'exists';

const copy: Record<Locale, Record<Template, Strings>> = {
  uz: {
    verify: { subject: 'FAITH: emailingizni tasdiqlang', intro: 'FAITHʼga xush kelibsiz.', action: 'Emailni tasdiqlash uchun havolani oching:', ignore: 'Agar bu siz boʻlmasangiz, ushbu xatni eʼtiborsiz qoldiring.' },
    reset: { subject: 'FAITH: parolni tiklash', intro: 'Parolni tiklash soʻrovi olindi.', action: 'Yangi parol oʻrnatish uchun havolani oching (1 soat amal qiladi):', ignore: 'Agar bu siz boʻlmasangiz, ushbu xatni eʼtiborsiz qoldiring.' },
    exists: { subject: 'FAITH: akkauntingiz allaqachon mavjud', intro: 'Bu email bilan roʻyxatdan oʻtishga urinish boʻldi, lekin akkaunt allaqachon mavjud.', action: 'Parolni unutgan boʻlsangiz, uni shu yerda tiklang:', ignore: 'Agar bu siz boʻlmasangiz, hech narsa qilish shart emas.' },
  },
  ru: {
    verify: { subject: 'FAITH: подтвердите email', intro: 'Добро пожаловать в FAITH.', action: 'Откройте ссылку, чтобы подтвердить email:', ignore: 'Если это были не вы, просто проигнорируйте письмо.' },
    reset: { subject: 'FAITH: сброс пароля', intro: 'Мы получили запрос на сброс пароля.', action: 'Откройте ссылку, чтобы задать новый пароль (действует 1 час):', ignore: 'Если это были не вы, просто проигнорируйте письмо.' },
    exists: { subject: 'FAITH: у вас уже есть аккаунт', intro: 'Кто-то пытался зарегистрироваться с этим email, но аккаунт уже существует.', action: 'Если вы забыли пароль, сбросьте его здесь:', ignore: 'Если это были не вы, ничего делать не нужно.' },
  },
  en: {
    verify: { subject: 'FAITH: confirm your email', intro: 'Welcome to FAITH.', action: 'Open this link to confirm your email:', ignore: 'If this was not you, you can ignore this message.' },
    reset: { subject: 'FAITH: reset your password', intro: 'We received a request to reset your password.', action: 'Open this link to set a new password (valid for 1 hour):', ignore: 'If this was not you, you can ignore this message.' },
    exists: { subject: 'FAITH: you already have an account', intro: 'Someone tried to register with this email, but an account already exists.', action: 'If you forgot your password, reset it here:', ignore: 'If this was not you, there is nothing you need to do.' },
  },
  tr: {
    verify: { subject: 'FAITH: e-postanızı doğrulayın', intro: 'FAITH’e hoş geldiniz.', action: 'E-postanızı doğrulamak için bağlantıyı açın:', ignore: 'Bu işlemi siz yapmadıysanız bu mesajı yok sayabilirsiniz.' },
    reset: { subject: 'FAITH: şifrenizi sıfırlayın', intro: 'Şifre sıfırlama isteği aldık.', action: 'Yeni şifre belirlemek için bağlantıyı açın (1 saat geçerlidir):', ignore: 'Bu işlemi siz yapmadıysanız bu mesajı yok sayabilirsiniz.' },
    exists: { subject: 'FAITH: zaten bir hesabınız var', intro: 'Birisi bu e-postayla kayıt olmayı denedi, ancak hesap zaten mevcut.', action: 'Şifrenizi unuttuysanız buradan sıfırlayın:', ignore: 'Bu siz değilseniz yapmanız gereken bir şey yok.' },
  },
  kk: {
    verify: { subject: 'FAITH: email мекенжайыңызды растаңыз', intro: 'FAITH-қа қош келдіңіз.', action: 'Email мекенжайын растау үшін сілтемені ашыңыз:', ignore: 'Егер бұл сіз болмасаңыз, хатты елемеңіз.' },
    reset: { subject: 'FAITH: құпиясөзді қалпына келтіру', intro: 'Құпиясөзді қалпына келтіру сұрауын алдық.', action: 'Жаңа құпиясөз орнату үшін сілтемені ашыңыз (1 сағат жарамды):', ignore: 'Егер бұл сіз болмасаңыз, хатты елемеңіз.' },
    exists: { subject: 'FAITH: сізде аккаунт бар', intro: 'Біреу осы email арқылы тіркелмек болды, бірақ аккаунт бұрыннан бар.', action: 'Құпиясөзді ұмытсаңыз, оны осы жерден қалпына келтіріңіз:', ignore: 'Егер бұл сіз болмасаңыз, ештеңе істеудің қажеті жоқ.' },
  },
  ar: {
    verify: { subject: 'FAITH: أكّد بريدك الإلكتروني', intro: 'مرحبًا بك في FAITH.', action: 'افتح هذا الرابط لتأكيد بريدك الإلكتروني:', ignore: 'إن لم تكن أنت، يمكنك تجاهل هذه الرسالة.' },
    reset: { subject: 'FAITH: إعادة تعيين كلمة المرور', intro: 'تلقينا طلبًا لإعادة تعيين كلمة المرور.', action: 'افتح هذا الرابط لتعيين كلمة مرور جديدة (صالح لمدة ساعة واحدة):', ignore: 'إن لم تكن أنت، يمكنك تجاهل هذه الرسالة.' },
    exists: { subject: 'FAITH: لديك حساب بالفعل', intro: 'حاول شخص ما التسجيل بهذا البريد، لكن الحساب موجود بالفعل.', action: 'إذا نسيت كلمة المرور، أعد تعيينها من هنا:', ignore: 'إن لم تكن أنت، فلا داعي لفعل أي شيء.' },
  },
  zh: {
    verify: { subject: 'FAITH:请验证您的邮箱', intro: '欢迎来到 FAITH。', action: '请打开此链接以验证您的邮箱:', ignore: '如果这不是您本人的操作,请忽略此邮件。' },
    reset: { subject: 'FAITH:重置密码', intro: '我们收到了重置密码的请求。', action: '请打开此链接设置新密码(1 小时内有效):', ignore: '如果这不是您本人的操作,请忽略此邮件。' },
    exists: { subject: 'FAITH:您已有账户', intro: '有人尝试使用此邮箱注册,但该账户已存在。', action: '如果您忘记了密码,请在此重置:', ignore: '如果这不是您本人的操作,无需进行任何处理。' },
  },
  es: {
    verify: { subject: 'FAITH: confirma tu correo', intro: 'Te damos la bienvenida a FAITH.', action: 'Abre este enlace para confirmar tu correo:', ignore: 'Si no fuiste tú, puedes ignorar este mensaje.' },
    reset: { subject: 'FAITH: restablece tu contraseña', intro: 'Recibimos una solicitud para restablecer tu contraseña.', action: 'Abre este enlace para crear una contraseña nueva (válido durante 1 hora):', ignore: 'Si no fuiste tú, puedes ignorar este mensaje.' },
    exists: { subject: 'FAITH: ya tienes una cuenta', intro: 'Alguien intentó registrarse con este correo, pero la cuenta ya existe.', action: 'Si olvidaste tu contraseña, restablécela aquí:', ignore: 'Si no fuiste tú, no necesitas hacer nada.' },
  },
};

export function renderEmail(template: Template, locale: string, link: string) {
  const s = (copy[locale as Locale] ?? copy.uz)[template];
  return { template, subject: s.subject, text: `${s.intro}\n\n${s.action}\n${link}\n\n${s.ignore}\n` };
}
