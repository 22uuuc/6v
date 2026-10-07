// EXPORTS: ISeedData, buildSeed()

import type {
  IUser,
  IBook,
  IChapter,
  IVisualScript,
  IComicChapter,
  IComicPage,
  IReview,
  ITx,
  IWithdrawChannel,
} from '@/lib/types';

export interface ISeedData {
  users: IUser[];
  books: IBook[];
  chapters: IChapter[];
  visualScripts: IVisualScript[];
  comicChapters: IComicChapter[];
  comicPages: IComicPage[];
  reviews: IReview[];
  txs: ITx[];
  channels: IWithdrawChannel[];
}

const day = (offset: number) => {
  const d = new Date(2026, 8, 12);
  d.setDate(d.getDate() + offset);
  return d.toISOString();
};

export function buildSeed(): ISeedData {
  const users: IUser[] = [
    { id: 'u-admin', username: 'admin', password: 'admin123', nickname: '墨影管家', role: 'admin', vip: true, banned: false, coins: 99999, withdrawable: 0, level: 6, exp: 9999, bio: '平台管理员', createdAt: day(-200) },
    { id: 'u-c1', username: 'zhiliao', password: '123456', nickname: '知了', role: 'creator', vip: true, banned: false, coins: 320, withdrawable: 2350, level: 4, exp: 1560, bio: '写悬疑的，喜欢夜里写', createdAt: day(-160) },
    { id: 'u-c2', username: 'ayu', password: '123456', nickname: '阿柚', role: 'creator', vip: false, banned: false, coins: 150, withdrawable: 880, level: 3, exp: 640, bio: '画点漫画，写点青春', createdAt: day(-140) },
    { id: 'u-c3', username: 'qingya', password: '123456', nickname: '青崖', role: 'creator', vip: false, banned: false, coins: 90, withdrawable: 420, level: 3, exp: 540, bio: '武侠迷，修仙也修', createdAt: day(-120) },
    { id: 'u-r1', username: 'reader1', password: '123456', nickname: '夜航船', role: 'reader', vip: true, banned: false, coins: 268, withdrawable: 0, level: 2, exp: 260, bio: '什么都看，主要看悬疑', createdAt: day(-90) },
    { id: 'u-r2', username: 'reader2', password: '123456', nickname: '追月', role: 'reader', vip: false, banned: false, coins: 460, withdrawable: 0, level: 1, exp: 40, bio: '', createdAt: day(-30) },
  ];

  const books: IBook[] = [
    {
      id: 'b1', type: 'novel', title: '巷口馄饨摊', authorId: 'u-c1', authorName: '知了',
      genre: '悬疑', status: 'published', coverSeed: 'street', coverStyle: 'dark', description:
        '凌晨一点四十，写字楼下的巷子里多了一个馄饨摊。老板娘只卖白汤馄饨，一碗下去，你会想起一件忘掉很久的事。阿凯以为自己是加班太累，后来他发现，有些事忘了，也许才是对的。',
      tags: ['都市', '悬疑', '细思极恐'], serial: 'serial', words: 1480, views: 12860, likes: 863, rating: 4.7,
      createdAt: day(-80), chapterPrice: 20, chapterIds: ['b1c1', 'b1c2', 'b1c3'], featured: true,
    },
    {
      id: 'b2', type: 'novel', title: '剑折山河', authorId: 'u-c3', authorName: '青崖',
      genre: '武侠', status: 'published', coverSeed: 'mountain', coverStyle: 'classic', description:
        '雪夜破庙，落魄剑客沈白生捡到一柄从地里犁出来的断剑。剑鞘上刻着一个“霜”字，跟他背了四年的断剑一模一样。山里来的东西，迟早要回到山里去。',
      tags: ['武侠', '仙侠', '雪夜'], serial: 'serial', words: 1520, views: 8640, likes: 421, rating: 4.5,
      createdAt: day(-70), chapterPrice: 0, chapterIds: ['b2c1', 'b2c2', 'b2c3'],
    },
    {
      id: 'b3', type: 'novel', title: '第七封信', authorId: 'u-c2', authorName: '阿柚',
      genre: '青春', status: 'published', coverSeed: 'campus', coverStyle: 'fresh', description:
        '师大广播站，每晚十点念一封匿名信。第一封讲食堂的红烧肉变咸了，第二封讲图书馆的蓝色保温杯……六封信念完，第七封一直没出现。没人知道写信的人是谁。',
      tags: ['青春', '校园', '暗恋'], serial: 'finished', words: 1600, views: 15240, likes: 1204, rating: 4.8,
      createdAt: day(-60), chapterPrice: 10, chapterIds: ['b3c1', 'b3c2', 'b3c3'], featured: true,
    },
    {
      id: 'b4', type: 'visual', title: '雾港灯塔', authorId: 'u-c1', authorName: '知了',
      genre: '悬疑', status: 'published', coverSeed: 'sea', coverStyle: 'dark', description:
        '雾夜的码头上，灯塔的光忽明忽灭。一个穿雨衣的人站在栈桥尽头，背对着你。你走过去，他回头——脸是你自己的。这是一部画面互动小说，你的每个选择都会改变结局。',
      tags: ['互动', '悬疑', '多结局'], serial: 'finished', words: 1200, views: 5240, likes: 210, rating: 4.6,
      createdAt: day(-45), chapterPrice: 50, chapterIds: ['b4n1'],
    },
    {
      id: 'b5', type: 'visual', title: '星轨尽头', authorId: 'u-c2', authorName: '阿柚',
      genre: '科幻', status: 'published', coverSeed: 'space', coverStyle: 'anime', description:
        '你从冬眠舱醒来，飞船 AI 说，地球的信号已经断了十二年。驾驶舱里有一罐没人喝的可乐，导航日志里有一条手写记录：“如果她醒了，告诉她我在织女四。”',
      tags: ['互动', '科幻', '浪漫'], serial: 'finished', words: 1000, views: 4320, likes: 189, rating: 4.7,
      createdAt: day(-35), chapterPrice: 50, chapterIds: ['b5n1'],
    },
    {
      id: 'b6', type: 'comic', title: '打工人小满', authorId: 'u-c2', authorName: '阿柚',
      genre: '都市', status: 'published', coverSeed: 'kitchen', coverStyle: 'fresh', description:
        '社畜小满的日常：闹钟响三次、咖啡当命续、PPT 改到十二点。但没关系，周末报复性放假，她把 PPT 丢进了海里。',
      tags: ['漫画', '搞笑', '打工人'], serial: 'serial', words: 600, views: 9920, likes: 750, rating: 4.6,
      createdAt: day(-25), chapterPrice: 30, chapterIds: ['b6k1', 'b6k2'],
    },
    {
      id: 'b7', type: 'comic', title: '山海异兽食堂', authorId: 'u-c3', authorName: '青崖',
      genre: '奇幻', status: 'published', coverSeed: 'tea-house', coverStyle: 'anime', description:
        '深夜食堂，只接待妖怪。九尾狐来吃拉面，饕餮来点甜点，老板只有一条规矩：吃饱了，就好好回去做人。',
      tags: ['漫画', '奇幻', '美食'], serial: 'finished', words: 600, views: 6120, likes: 356, rating: 4.8,
      createdAt: day(-15), chapterPrice: 30, chapterIds: ['b7k1', 'b7k2'],
    },
    // 待审核示例作品（后台审核功能演示）
    {
      id: 'b8', type: 'novel', title: '雾里看花人', authorId: 'u-c1', authorName: '知了',
      genre: '悬疑', status: 'pending', coverSeed: 'ghost', coverStyle: 'dark', description:
        '深夜花店，只卖给失眠的人。每朵花都有一个名字，名字里藏着一桩旧事。新作审核中。',
      tags: ['悬疑', '都市'], serial: 'serial', words: 0, views: 0, likes: 0, rating: 0,
      createdAt: day(-2), chapterPrice: 20, chapterIds: ['b8c1'],
    },
    {
      id: 'b9', type: 'novel', title: '山河入我怀', authorId: 'u-c3', authorName: '青崖',
      genre: '玄幻', status: 'published', coverSeed: 'mountain', coverStyle: 'dark', description:
        '小捕快程九在城隍庙值夜，撞见一桩没人敢接的案子：庙里的泥塑神像，一夜之间全偏过头，朝着同一个方向。他顺着看过去，方向尽头是一座荒山。山里有东西，等了他很多年。',
      tags: ['玄幻', '神像', '入山'], serial: 'serial', words: 860, views: 3180, likes: 142, rating: 4.5,
      createdAt: day(-9), chapterPrice: 15, chapterIds: ['b9c1'], featured: true,
    },
    {
      id: 'b10', type: 'novel', title: '放学后的观测者', authorId: 'u-c2', authorName: '阿柚',
      genre: '轻小说', status: 'published', coverSeed: 'campus', coverStyle: 'anime', description:
        '天文社的活动室在天台角落，只有三个人：社长、我、还有一只总在窗台上打盹的猫。可最近，望远镜里那颗编号 7-13 的星星，每晚都会提前三分钟升起。社长说她在记，我在看，猫在睡。谁都没提，那三分钟去了哪里。',
      tags: ['轻小说', '校园', '星星'], serial: 'serial', words: 920, views: 2710, likes: 168, rating: 4.8,
      createdAt: day(-5), chapterPrice: 10, chapterIds: ['b10c1'], featured: true,
    },
  ];

  const chapters: IChapter[] = [
    {
      id: 'b1c1', bookId: 'b1', index: 1, title: '白汤', price: 0,
      content:
        '凌晨一点四十，写字楼下面那条巷子，多了一个馄饨摊。\n\n阿凯本来没想吃。他加完班，手机剩百分之三的电，胃里像塞了一团湿棉花。摊子支在路灯底下，白汽一蓬一蓬往上顶，老板娘背对着他，在数碗。\n\n“一碗白汤。”她说，没回头。\n\n阿凯坐下。凳子只有三张，全空着。他低头看手机，电已经关了机。\n\n馄饨端上来。汤是白的，不浑，碗沿烫手。阿凯舀了一个，咬开，馅是荠菜的。他嚼了两口，忽然想起一件奇怪的事——他六岁那年丢过一串钥匙，他妈找了一下午，把家里的沙发都翻过来。他一直没想起来钥匙丢在哪。\n\n可这一口下去，他想起来了。钥匙卡在阳台花盆底下，铁锈味。\n\n他愣住，抬头。老板娘已经站在他面前，围裙上别着一根红色的毛线针。\n\n“吃完了？”她问。\n\n碗空了。阿凯不知道什么时候吃完的。他张了张嘴，想问什么，老板娘把碗收走，擦了擦桌子。\n\n“明天别来。”她说，“明天你该想起的不是钥匙。”\n\n阿凯回办公室拿充电器的时候，电梯里碰到保洁王姐。王姐看他一眼，说：“你脸色怎么这么白？”\n\n他摸了摸脸。手是凉的。',
    },
    {
      id: 'b1c2', bookId: 'b1', index: 2, title: '雨鞋', price: 20,
      content:
        '第二天阿凯没加班。他七点就下楼，巷子口没有摊子。路灯底下干干净净，连个推车的印子都没有。\n\n他站了十分钟，掏出手机搜“白汤馄饨”，搜出来三百多家，没有一家在写字楼旁边。\n\n第三天他加班到十一点，下楼的时候腿自己往巷子里走。摊子又在了。老板娘在数碗，数了三遍。\n\n“我说了别来。”她说，但给他舀了一碗。\n\n阿凯这次没马上吃。他盯着汤，问：“你认识我？”\n\n“不认识。”老板娘说，“但我认识你丢的东西。”\n\n她把碗推过来：“先吃。”\n\n阿凯吃了。这一口，他想起的是大学毕业那天。他爸在火车站送他，塞给他两百块钱，他嫌少，把钱推回去，说了句“不用你管”。那是他最后一次见他爸。\n\n阿凯放下筷子，手有点抖。\n\n“你爸没死。”老板娘忽然说。\n\n阿凯猛地抬头。老板娘用那根红毛线针剔着指甲，眼皮都没抬：“你记错了。他上个月还来吃过我的馄饨，点了两碗。”\n\n“不可能。”阿凯说，“他五年前就——”\n\n他说到一半，卡住了。五年前？他忽然想不起来他爸的样子了。越想越模糊，像一张泡了水的照片。\n\n老板娘叹了口气：“你这碗，白吃了。”\n\n她收了碗，把碗摞在一起。阿凯看见她围裙口袋里露出一截车票。上个月的日期，终点站是他老家。\n\n他张了张嘴。老板娘已经转过身，开始洗锅，水声哗哗的。',
    },
    {
      id: 'b1c3', bookId: 'b1', index: 3, title: '空碗', price: 20,
      content:
        '阿凯连着一个月没再见到那个摊子。他把能请的假都请了，回了趟老家。他爸好好的，在院子里喂鸡，看见他回来愣了一下，说：“你脸色怎么这么白。”\n\n阿凯在他爸家住了三天。什么都没发生。临走那天，他妈把他拉到一边，欲言又止，最后只说了句：“你小时候那串钥匙，在阳台花盆底下找着了。”\n\n阿凯站在门口，太阳晒得他眼睛疼。\n\n回城之后，他每天下班都绕到那条巷子。摊子再也没有出现过。巷口的路灯换了新的，亮得刺眼。\n\n直到第七天，他在巷子拐角捡到一只碗。白瓷，碗沿磕了一个口子，底下用红漆写着两个字——他的名字。\n\n阿凯把碗带回家，洗了三遍，放在餐桌上。他盯着看了很久，最后还是没舍得扔。\n\n那晚他睡得特别早。梦里老板娘背对着他数碗，数到第七遍，回头了。\n\n“你丢的东西，”她说，“有时候不是钥匙。”\n\n阿凯醒来的时候，天还没亮。他打开手机，他爸给他发了一条消息，说家里鸡下了双黄蛋，拍张照给他看。\n\n他回了一个“好”字，然后关掉手机，把那碗收进柜子里。\n\n碗在柜子里放了很多年。搬家的时候他差点弄丢，又找了回来。他一直没想明白那碗是谁的，也没想明白自己到底丢了什么。\n\n有些事想不明白，就不想了。像那碗白汤馄饨，他后来再也没吃过一样的味道。',
    },
    {
      id: 'b2c1', bookId: 'b2', index: 1, title: '断剑', price: 0,
      content:
        '雪下到第三天，破庙的屋顶塌了一角。\n\n沈白生坐在神像脚下，把火堆拨旺了一点。火是神像的胳膊烧的，木头干透了，烧起来有股陈年香灰味。他身上还剩半块干饼，硬得能砸核桃，就着雪水咽了。\n\n庙外有声音。不是风。是脚步声，一步，停，一步，停。\n\n沈白生没动。他把手按在腰间的剑鞘上——剑是断的，半截，他背了四年。\n\n脚步声到了庙门口，停了。一个小孩探进半个脑袋，大约七八岁，脸冻得通红，怀里抱着一柄剑。剑比他还高，拖在地上，剑鞘上全是泥。\n\n“叔，”小孩说，“你要剑不？不要钱。”\n\n沈白生看了他一眼：“哪来的？”\n\n“我家田里捡的。”小孩说，“犁地犁出来的。我妈说是不祥的东西，让我扔河里去。我寻思扔了可惜。”\n\n沈白生想说不收。话到嘴边，他看见那剑鞘上刻着一个字——霜。\n\n他背了四年的断剑上，也刻着同一个字。\n\n“拿过来。”他说。\n\n小孩把剑拖过来，沈白生接住。剑很沉，入手的瞬间，他掌心一麻，像是被什么蛰了一下。他没松手。\n\n“你走吧。”他说，“别跟人说见过我。”\n\n小孩走了。雪还在下。沈白生把新剑放在膝上，没拔。他伸手摸了摸剑鞘上的霜字，指腹有点发抖。\n\n那字他认得。是他师父的字。',
    },
    {
      id: 'b2c2', bookId: 'b2', index: 2, title: '灯下', price: 0,
      content:
        '第二天傍晚，村里的猎户老周扛着一头野猪进山，天黑没回来。第三天，他的猎狗跑回村，狗脖子上的皮开了一道口子，血把毛都粘住了。\n\n村里人说，后山来了东西。不是野猪，是比野猪大得多的东西，夜里能听见它拱土的声音，像牛，又不像牛。\n\n村长提着两斤腊肉，站在破庙门口。沈白生正在劈柴，斧头落下去，木头裂成两半。\n\n“先生，”村长说，“村里人凑了钱，想请您去后山看看。山魈，吃人的那种。”\n\n沈白生没说话。他把柴火码好，用脚踩实。\n\n“我不白干。”他说，“一斤米。”\n\n村长连忙点头：“有，有。”\n\n那天夜里，沈白生提着那柄新得的剑上了后山。剑很沉，他用了四年断剑，手已经不习惯这么长的剑。月亮很亮，雪地反着光。\n\n山魈在后山坳子里。很大，蹲着像半间屋子，眼睛在夜里是绿的。它看见沈白生，站起来，低吼了一声，震得树枝上的雪簌簌地掉。\n\n沈白生拔剑。\n\n剑出鞘的声音，他自己都愣了一下——那不是铁器的声音，像是谁在很远的地方笑了一声。山魈扑过来的时候，他侧身，剑横着扫过去。\n\n他只出了一剑。\n\n山魈站住了，脖子上一道细细的红线，慢慢渗出来。然后它倒了，砸起一片雪雾。\n\n沈白生站在原地，手没抖。他低头看剑，剑身上没有血，干干净净。\n\n他把剑收回鞘里，往回走。走了两步，他停下来，回头看了一眼山魈的尸体，又看了看自己的手。\n\n四年了。他第一次觉得，手是热的。',
    },
    {
      id: 'b2c3', bookId: 'b2', index: 3, title: '问剑', price: 0,
      content:
        '山魈的事传出去之后，村里人看沈白生的眼神变了。腊肉、米、鸡蛋，往庙里送了一堆。没人敢进庙，都在门口放下就走。\n\n沈白生没出来收。他在庙里坐了两天，把那柄新剑翻来覆去地看。剑身乌黑，没有花纹，只有靠近护手的地方，有一条细细的裂纹，像一条干涸的河。\n\n第三天夜里，沈白生睡着。醒来的时候，剑立在床头，插在土里。\n\n他睡前明明把剑靠在墙角。\n\n沈白生坐起来，盯着那把剑。剑身朝着北方，微微倾斜，像一个人伸着手臂，指着一个方向。\n\n“你要我去哪？”他问。\n\n剑当然不会回答。\n\n沈白生沉默了一会儿，伸手把剑拔起来，插回腰间。他站起来，走到庙门口，雪已经停了。月亮挂在山尖上，地上白茫茫一片，往北看，山影重重叠叠。\n\n他想起师父最后一次教他的话。那时候他还小，师父指着北方说：山外头还有山，剑折了，人心别折。\n\n沈白生背着剑，下了山，往北走。\n\n他走了很远。后来江湖上有人说，雪夜里见过一个背剑的人，剑鞘上刻着一个霜字。有人说他是疯子，有人说他是剑客。没人说得清。\n\n只有那把剑知道，他要去的地方。',
    },
    {
      id: 'b3c1', bookId: 'b3', index: 1, title: '广播', price: 0,
      content:
        '师大广播站，每晚十点，念一封匿名信。\n\n念信的是大三的郑也。他声音没什么起伏，像念课文，但奇怪的是，每封信念完，操场上的人都会安静几秒。没人知道写信的人是谁，也没人知道这些信是写给谁的。\n\n第一封信念的是：“食堂二楼的红烧肉，从昨天开始变咸了。打菜的阿姨，能不能少放一勺盐。”\n\n没人笑。因为大家都发现，红烧肉确实变咸了。\n\n第二封：“图书馆四楼靠窗的位子，有人每天七点来，把保温杯放在桌上，然后去接水。保温杯是蓝色的，盖子上贴了一张贴纸，贴纸是只猫。我想认识那个人，但我不知道怎么说。”\n\n第三封：“教五楼那只橘猫，上周被车撞了。送它去医院的是个男生，他蹲在路边哭了好久。我看见他哭了，我没敢过去。”\n\n郑也念完这封，广播里沉默了很久。他自己也顿了一下，才念出下一句：“如果那个男生在听广播，我想说，它没死。它好了。明天它还会趴在教五楼门口晒太阳。”\n\n那晚之后，师大突然多了很多愿意说话的人。有人开始给广播站写信，有人匿名在表白墙上找那只橘猫的救命恩人。\n\n但没有人知道，写信的人是谁。',
    },
    {
      id: 'b3c2', bookId: 'b3', index: 2, title: '六封', price: 10,
      content:
        '第七封信一直没出现。前六封信是连着六天念完的，之后广播站再没收到过匿名信。郑也每天十点准时开播，念完当天的新闻稿，就放一首歌。\n\n他其实知道写信的人是谁。\n\n准确地说，他是唯一知道的人。因为那些信，是他自己写的。\n\n郑也写第一封信的时候，是赌气。他暗恋隔壁班的周栀，三年了，没敢说。他给自己定了个规矩：写七封信，写到第七封，就去找她。\n\n第一封写红烧肉，是周栀上周在食堂说了一句“这肉变咸了”，他记下来了。\n\n第二封写保温杯，是周栀的。\n\n第三封写橘猫，也是周栀的。他那天其实也蹲在路边，蹲在另一个树后面，看见她哭，他没敢过去。\n\n第四封到第六封，他写的是周栀喜欢的东西：操场边上的桂花、图书馆门口的风铃、她总在听的广播站歌单。\n\n他想写第七封。他打了八百次腹稿，每次都在纸上写一句“周栀”，然后划掉。划到纸都快破了。\n\n第七天，广播站照常开播。郑也念完新闻，放了一首周栀喜欢的歌。\n\n他在心里说：第七封信，我写不出来。因为我怕你说，你知道了又怎么样。',
    },
    {
      id: 'b3c3', bookId: 'b3', index: 3, title: '署名', price: 10,
      content:
        '毕业典礼那天，广播站最后一次开放点歌。郑也已经要离开学校了，他考上了外地的研究生，行李都收拾好了。\n\n下午四点，有人在广播站的投稿箱里塞了一封信。值班的学弟拿起来，信封很薄，只写了一句：“请十点整念。”\n\n十点整。学弟打开信封，里面只有一张纸条，字很娟秀：\n\n“第七封信，我写给你。第一封红烧肉，是我编的。第二封保温杯，是你故意放错桌子的，我看见了。第三封橘猫，你蹲在树后面，哭的是我，没哭的是你，你装得不像。第四封到第六封，都是你自己写的，我猜到了。郑也，我等你第七封，等了三年。这一封，我替你写了。——周栀”\n\n学弟念完，整栋楼都安静了。\n\n郑也在宿舍楼下站着。他手里攥着一张皱巴巴的纸，纸上是写了八百遍又划掉的名字。他听见广播里周栀的名字，蹲下来，把脸埋进膝盖里。\n\n有人拍了他一下。他抬头，周栀站在路灯底下，提着一袋行李，冲他笑：“走不走？高铁票我买了两张。”\n\n郑也站起来，手里那张纸，他终于没递出去。他把它揉成一团，揣进兜里。\n\n“走。”他说。\n\n后来那张纸一直在他钱包里。很多年后搬家，他翻出来，纸已经皱了。上面密密麻麻全是“周栀”两个字，最后一个没划掉。\n\n他没舍得扔。',
    },
    { id: 'b8c1', bookId: 'b8', index: 1, title: '夜来香', price: 20, content: '（作品审核中，正文待上线）\n\n深夜十一点，花店门口挂着一盏白灯笼。失眠的人会走进来，买一朵花，说出一个名字。\n\n老板从不问，你为什么睡不着。\n\n——新书第一章试读，审核通过后开放。' },
    {
      id: 'b9c1', bookId: 'b9', index: 1, title: '神像转头', price: 0,
      content:
        '城隍庙的灯，入夜后就没人换。程九拎着灯笼进去的时候，香灰味扑了一脸，呛得他咳了两声。\n\n他值夜，管的是庙前的街。后半夜没什么人，他就坐在庙门槛上，拿刀鞘敲鞋底的泥。\n\n敲到第三下，他听见身后有声音。像陶器裂开，又像骨头转了个向，极轻，咯嘣一声。\n\n程九回头。\n\n供桌后头那尊城隍像，偏着头，看着他。\n\n他以为自己眼花了。灯芯太暗，风一吹，影子乱晃。他揉了揉眼，再抬头，神像的头回正了，端端正正坐着。\n\n程九盯着看了很久，没敢动。他告诉自己，是风吹的。风能吹动泥塑的头？他自己也知道这说不过去。\n\n天亮交班，他随口跟老捕头提了一嘴。老捕头正在喝稀饭，筷子停在半空，看着他：“你说城隍爷转头？”\n\n“也许是我看岔了。”\n\n老捕头放下碗，慢悠悠说：“昨儿夜里，城隍庙后头的财神庙，财神像也转头了。庙祝起夜看见的，吓得一宿没敢睡。”\n\n程九没说话。他想起自己看到的那个方向——神像偏头，朝着西北。\n\n西北方，有一座荒山。\n\n山叫望归山。三年前闹过一次山崩，埋了半座村，之后没人再上山。\n\n程九的值夜，从此多了件事：每天半夜，他都会去庙里看一眼。神像的头，一天比一天偏。到第七天，整尊像几乎转了九十度，直直朝着西北。\n\n第八天夜里，程九提着灯笼，站在庙门口。他看了一眼望归山的方向，山黑得像一堵墙。\n\n他摸了摸腰间的刀，说：“行。”\n\n他往山里走。身后，庙里的灯，自己灭了。',
    },
    {
      id: 'b10c1', bookId: 'b10', index: 1, title: '三分钟', price: 0,
      content:
        '天文社的活动室，在天台角落。门上挂着一块歪了的牌子，写着「天文观测部」，括号里补了一行小字：人少，勿扰。\n\n社长叫林栀，高二，戴一副圆框眼镜。她记数据从来不抄本子，直接写在手背上，写满了就洗掉，再写。\n\n我负责看望远镜。社团经费少，望远镜是二手淘的，镜筒上还贴着上一任社长的名字。据说那位学长毕业后去了天文台，信里说，这台镜子有点毛病：看得远，但记不住时间。\n\n我没当真。\n\n直到那天晚上，林栀忽然把手背伸到我面前，上面画了一排数字，最后一行是「7-13」。\n\n“你看，”她说，“这颗星，今晚升起来的时间，比昨晚早了整整三分钟。”\n\n我凑到目镜前。7-13 亮得很规矩，在猎户座旁边，安安静静。\n\n“会不会是你记错了？”我说。\n\n“我记了三周了。”她说，“每天都早三分钟。不多不少，正好三分钟。”\n\n窗台上，那只猫翻了个身，尾巴尖动了动，没醒。\n\n那晚熄灯前，我躺在床上，算了笔账：三周，每天早三分钟，加起来，这颗星比三周前，提前升起了六十三分钟。\n\n它在靠近。\n\n朝着我们。',
    },
  ];

  const visualScripts: IVisualScript[] = [
    {
      bookId: 'b4',
      startNode: 'b4n1',
      nodes: [
        {
          id: 'b4n1', scene: 'sea', text: '雾夜的码头上，灯塔的光忽明忽灭。海风把盐味灌进你嘴里，你醒过来的时候，就站在这里，不知道走了多远。栈桥尽头，一个穿雨衣的人背对着你站着。',
          speaker: '你', choices: [{ label: '走过去', next: 'b4n2' }, { label: '喊他一声', next: 'b4n3' }, { label: '转身往回走', next: 'b4n6' }],
        },
        {
          id: 'b4n2', scene: 'sea', text: '你走过去，鞋底踩在湿木板上，声音闷闷的。那人听见了，慢慢回过头。雨衣帽子底下那张脸——是你自己。他冲你笑了笑，嘴角的弧度跟你笑的时候一模一样。',
          speaker: '你', choices: [{ label: '问他：“你是谁？”', next: 'b4n4' }, { label: '后退两步', next: 'b4n5' }],
        },
        {
          id: 'b4n3', scene: 'sea', text: '你喊了一声：“喂——”声音被海风扯碎了。那人没回头，但灯塔的光突然灭了。黑暗里，你听见栈桥另一头传来脚步声，一步，停，一步，停。',
          speaker: '你', choices: [{ label: '摸黑往前走', next: 'b4n4' }, { label: '蹲下，等灯亮', next: 'b4n7' }],
        },
        {
          id: 'b4n4', scene: 'sea', text: '灯重新亮起来的时候，栈桥上没有人。湿掉的栈板上有一滩水，形状像一个人刚刚站过。你低头看自己的鞋，鞋底干干的。远处灯塔的灯，亮得像一只眼睛。',
          speaker: '你', ending: true, endingTitle: '真相', choices: [{ label: '回到灯塔守下去', next: 'b4n8' }],
        },
        {
          id: 'b4n5', scene: 'ghost', text: '你退后一步，后背撞上什么东西。不是墙，是温的，会呼吸。你僵在原地，听见身后那个人说：“我等了你三年，你终于来了。”声音是从你喉咙里发出来的。',
          speaker: '你', choices: [{ label: '回头看看', next: 'b4n7' }],
        },
        {
          id: 'b4n6', scene: 'tea-house', text: '你转身往回走，走了十步，发现自己站在一家茶馆门口。门帘是蓝布的，屋里亮着灯，老板娘在给你倒茶，像是早就知道你会来。“坐下吧，”她说，“喝碗热的，再想你是谁。”',
          speaker: '老板娘', choices: [{ label: '喝下那碗茶', next: 'b4n9' }, { label: '不喝，问她这是哪', next: 'b4n5' }],
        },
        {
          id: 'b4n7', scene: 'ghost', text: '雾越来越浓，栈桥像被吞进一锅白汤里。你站在原地，听见脚步声绕着你转了三圈，然后停了。雾散开的时候，你发现自己站在灯塔底下，灯塔的门开着，里面亮着灯。你在门口坐了一夜，天亮时，雾散了。你还是没想起来，自己是谁。',
          speaker: '你', ending: true, endingTitle: '迷失', choices: [{ label: '重新开始这个故事', next: 'b4n1' }],
        },
        {
          id: 'b4n8', scene: 'sea', text: '你沿着栈桥走回灯塔，推开门。灯塔里很干净，桌上放着一本值班日志，翻到最后一页，上面是你自己的字迹：“如果有一天我忘了自己是谁，请让我想起，我还有个儿子，在等爸爸回家。”你握着日志，站了很久。海风从门外灌进来，灯塔的光一圈一圈地转。你终于想起来了。',
          speaker: '你', ending: true, endingTitle: '回家', choices: [{ label: '重新开始这个故事', next: 'b4n1' }],
        },
        {
          id: 'b4n9', scene: 'tea-house', text: '茶很烫，你一小口一小口喝完。老板娘看着你，忽然说：“你是个守塔人。三年前的台风天，你把船让给了一个孕妇，自己留在了塔上。”你放下茶杯，杯底有一行字：雾港灯塔，永远为你亮着。你走出茶馆，天已经亮了。码头上，一个年轻人提着一盏灯，朝你跑过来，喊你：“爸！”',
          speaker: '你', ending: true, endingTitle: '灯塔', choices: [{ label: '重新开始这个故事', next: 'b4n1' }],
        },
      ],
    },
    {
      bookId: 'b5',
      startNode: 'b5n1',
      nodes: [
        {
          id: 'b5n1', scene: 'space', text: '冬眠舱的盖子弹开，冷气喷了你一脸。你坐起来，舷窗外是密密麻麻的星星，一动不动。飞船 AI 的声音从头顶传来：“早安，航行者。今天是地球信号中断的第四百三十七天。准确地说，是十二年零九天。”',
          speaker: 'AI', choices: [{ label: '问它：“船上还有别人吗？”', next: 'b5n2' }, { label: '要求返航', next: 'b5n3' }],
        },
        {
          id: 'b5n2', scene: 'space', text: 'AI 沉默了两秒，说：“没有。除了你。”顿了顿，它又说：“但驾驶舱的冷藏柜里，有一罐可乐。是上一个船员留给你的。他离开前说，如果你醒了，记得喝。”你打开冷藏柜，可乐罐上贴着一张便签：“给醒来的那个人。别谢我，我也喝过别人的。”',
          speaker: 'AI', choices: [{ label: '喝掉那罐可乐', next: 'b5n4' }, { label: '不喝，先去看导航日志', next: 'b5n3' }],
        },
        {
          id: 'b5n3', scene: 'space', text: '你翻开导航日志，大多数记录是 AI 自动生成的。翻到最后一页，你看见一条手写记录，字迹很潦草：“如果她醒了，告诉她，我在织女四。林。”你盯着“林”这个字，看了很久。你认识一个姓林的。那是在很久以前，你上船之前。',
          speaker: '你', choices: [{ label: '输入新航向：织女四', next: 'b5n5' }, { label: '相信地球还活着，返航', next: 'b5n6' }],
        },
        {
          id: 'b5n4', scene: 'space', text: '你拉开拉环，汽水声在安静的船舱里响得吓人。你喝了一口，甜的，有点呛。你忽然想起来，上一次喝可乐，是你上船那天。林在发射场外隔着玻璃跟你挥手，他手里也拿着一罐可乐，冲你晃了晃。你当时想，回来再喝。你没想到，这一走，就是十二年。',
          speaker: '你', choices: [{ label: '输入新航向：织女四', next: 'b5n5' }],
        },
        {
          id: 'b5n5', scene: 'space', text: '飞船调头，向着织女四飞去。航程很长，你每天坐在驾驶舱里，看星星从窗外流过。可乐罐放在仪表盘旁边，你一直没扔。第十一天，飞船穿过一片星云，前方出现一颗蓝绿色的星球。AI 说：“到达织女四。检测到地面信标，正在对接。”气闸门打开之前，你听见外面有人跑过来的脚步声。门开，林站在门口。他老了很多，头发白了一半，但他冲你笑的样子，还是跟十二年前一样。',
          speaker: '你', ending: true, endingTitle: '重逢', choices: [{ label: '重新开始这个故事', next: 'b5n1' }],
        },
        {
          id: 'b5n6', scene: 'space', text: '你选择返航。飞船掉头，向着地球的方向飞去。航程第七天，燃料告警响起。你检查了一遍，确认没有挽回的余地。你没有害怕，只是把可乐罐放在仪表盘上，撕了张便签，写上：“我回家了。可乐留给你。林，如果你回来看见，替我喝掉它。”你躺回冬眠舱，盖子合上之前，你最后看了一眼窗外。星星很多，你分不清哪一颗是地球。',
          speaker: '你', ending: true, endingTitle: '告别', choices: [{ label: '重新开始这个故事', next: 'b5n1' }],
        },
      ],
    },
  ];

  const comicChapters: IComicChapter[] = [
    { id: 'b6k1', bookId: 'b6', index: 1, title: '周一', pageIds: ['b6p1', 'b6p2', 'b6p3'], price: 0 },
    { id: 'b6k2', bookId: 'b6', index: 2, title: '提案', pageIds: ['b6p4', 'b6p5', 'b6p6'], price: 30 },
    { id: 'b7k1', bookId: 'b7', index: 1, title: '九尾狐的拉面', pageIds: ['b7p1', 'b7p2', 'b7p3'], price: 0 },
    { id: 'b7k2', bookId: 'b7', index: 2, title: '饕餮的甜点', pageIds: ['b7p4', 'b7p5', 'b7p6'], price: 30 },
  ];

  const comicPages: IComicPage[] = [
    { id: 'b6p1', bookId: 'b6', chapterId: 'b6k1', index: 1, scene: 'street', caption: '周一的闹钟，响了三次。', dialogue: ['小满：再睡五分钟……', '猫：喵。', '小满：你也不想起床对吧，我懂你。'] },
    { id: 'b6p2', bookId: 'b6', chapterId: 'b6k1', index: 2, scene: 'kitchen', caption: '茶水间，一天的开端。', dialogue: ['同事：今天喝的不是咖啡，是命。', '小满：干了这杯，还有三杯。'] },
    { id: 'b6p3', bookId: 'b6', chapterId: 'b6k1', index: 3, scene: 'night-city', caption: '晚上十点，终于下班。', dialogue: ['小满：地铁还有三站……我还能活。', '旁白：她活了。周一结束了。'] },
    { id: 'b6p4', bookId: 'b6', chapterId: 'b6k2', index: 1, scene: 'street', caption: '提案前夜，小满买了个包子。', dialogue: ['包子铺老板：姑娘，黑眼圈比包子还大。', '小满：谢谢，我会带着它战斗。'] },
    { id: 'b6p5', bookId: 'b6', chapterId: 'b6k2', index: 2, scene: 'night-city', caption: '凌晨十二点，PPT 改了第八版。', dialogue: ['小满：第八版了……客户到底要什么？', '电脑：你猜。', '小满：我猜他想让我死。'] },
    { id: 'b6p6', bookId: 'b6', chapterId: 'b6k2', index: 3, scene: 'sea', caption: '提案通过！周末报复性放假。', dialogue: ['小满：我把 PPT 丢进了海里。', '浪：哗——', '小满：再见，第八版。'] },
    { id: 'b7p1', bookId: 'b7', chapterId: 'b7k1', index: 1, scene: 'tea-house', caption: '山海异兽食堂，深夜营业。', dialogue: ['九尾狐：老板，一碗拉面，汤要浓。', '老板：你尾巴这么多，站门口挡路了。', '九尾狐：……这是我新做的造型。'] },
    { id: 'b7p2', bookId: 'b7', chapterId: 'b7k1', index: 2, scene: 'kitchen', caption: '老板的汤底，会发光。', dialogue: ['老板：秘方，不外传。', '九尾狐：你汤里是不是放了龙鳞？', '老板：不是。是葱。'] },
    { id: 'b7p3', bookId: 'b7', chapterId: 'b7k1', index: 3, scene: 'tea-house', caption: '吃完，尾巴一根一根亮了。', dialogue: ['九尾狐：好吃。三百年没这么好吃过了。', '老板：吃完就回去好好修炼。', '九尾狐：知道了知道了。'] },
    { id: 'b7p4', bookId: 'b7', chapterId: 'b7k2', index: 1, scene: 'kitchen', caption: '饕餮进门，地都在抖。', dialogue: ['饕餮：老板！把你们店最甜的东西全端上来！', '老板：你上次吃了三座山。', '饕餮：那是点心，不算。'] },
    { id: 'b7p5', bookId: 'b7', chapterId: 'b7k2', index: 2, scene: 'kitchen', caption: '蛋糕山，端了上来。', dialogue: ['饕餮：就……就这？', '老板：吃不完不收钱。', '饕餮：你等着。'] },
    { id: 'b7p6', bookId: 'b7', chapterId: 'b7k2', index: 3, scene: 'sea', caption: '饕餮吃完，打了个嗝。', dialogue: ['饕餮：嗝。', '旁白：整个食堂安静了三秒。', '老板：……明天再来，打八折。'] },
  ];

  const reviews: IReview[] = [
    { id: 'rv1', bookId: 'b1', action: 'approve', note: '内容优质，通过', createdAt: day(-79) },
    { id: 'rv2', bookId: 'b2', action: 'approve', note: '', createdAt: day(-69) },
    { id: 'rv3', bookId: 'b3', action: 'approve', note: '文笔细腻', createdAt: day(-59) },
  ];

  const txs: ITx[] = [
    { id: 'tx1', userId: 'u-r1', kind: 'recharge', amount: 30, coin: 3000, note: '充值 30 元', createdAt: day(-20) },
    { id: 'tx2', userId: 'u-r1', kind: 'subscribe', amount: 20, coin: -20, note: '订阅《巷口馄饨摊》第2章', createdAt: day(-18) },
    { id: 'tx3', userId: 'u-r1', kind: 'vip', amount: 18, coin: -1800, note: '开通月度 VIP', createdAt: day(-15) },
    { id: 'tx4', userId: 'u-r2', kind: 'recharge', amount: 12, coin: 1200, note: '充值 12 元', createdAt: day(-10) },
    { id: 'tx5', userId: 'u-r2', kind: 'tip', amount: 50, coin: -50, note: '打赏《第七封信》', createdAt: day(-8) },
    { id: 'tx6', userId: 'u-r1', kind: 'subscribe', amount: 50, coin: -50, note: '解锁《雾港灯塔》', createdAt: day(-6) },
    { id: 'tx7', userId: 'u-r2', kind: 'tip', amount: 100, coin: -100, note: '打赏《打工人小满》', createdAt: day(-4) },
    { id: 'tx8', userId: 'u-c1', kind: 'reward', amount: 0, coin: 420, note: '作品订阅分成入账', createdAt: day(-3) },
    { id: 'tx9', userId: 'u-c2', kind: 'reward', amount: 0, coin: 260, note: '打赏与订阅分成入账', createdAt: day(-2) },
  ];

  const channels: IWithdrawChannel[] = [
    { id: 'ch1', userId: 'u-c1', type: 'alipay', account: '13800001111', accountName: '知了', status: 'approved', createdAt: day(-50) },
    { id: 'ch2', userId: 'u-c2', type: 'wechat', account: 'wxshenqi888', accountName: '阿柚', status: 'pending', createdAt: day(-1) },
  ];

  return { users, books, chapters, visualScripts, comicChapters, comicPages, reviews, txs, channels };
}
