// 8 Quái (Trigrams)
export const TRIGRAMS = {
  '111': { name: 'Càn', han: '乾', symbol: '☰', element: 'Kim', nature: 'Trời', family: 'Cha' },
  '000': { name: 'Khôn', han: '坤', symbol: '☷', element: 'Thổ', nature: 'Đất', family: 'Mẹ' },
  '001': { name: 'Chấn', han: '震', symbol: '☳', element: 'Mộc', nature: 'Sấm', family: 'Trưởng Nam' },
  '110': { name: 'Tốn', han: '巽', symbol: '☴', element: 'Mộc', nature: 'Gió', family: 'Trưởng Nữ' },
  '010': { name: 'Khảm', han: '坎', symbol: '☵', element: 'Thủy', nature: 'Nước', family: 'Trung Nam' },
  '101': { name: 'Ly', han: '離', symbol: '☲', element: 'Hỏa', nature: 'Lửa', family: 'Trung Nữ' },
  '100': { name: 'Cấn', han: '艮', symbol: '☶', element: 'Thổ', nature: 'Núi', family: 'Thiếu Nam' },
  '011': { name: 'Đoài', han: '兌', symbol: '☱', element: 'Kim', nature: 'Đầm', family: 'Thiếu Nữ' },
};

// 64 Quẻ: [number, name, han, upper_trigram, lower_trigram, short_meaning]
export const HEXAGRAMS = [
  [1,'Thuần Kiền','乾','111','111','Trời, mạnh mẽ, sáng tạo, khởi đầu'],
  [2,'Thuần Khôn','坤','000','000','Đất, nhu thuận, bao dung, tiếp nhận'],
  [3,'Thủy Lôi Truân','屯','010','001','Khó khăn ban đầu, kiên nhẫn sẽ thành'],
  [4,'Sơn Thủy Mông','蒙','100','010','Mông muội, cần học hỏi, khai sáng'],
  [5,'Thủy Thiên Nhu','需','010','111','Chờ đợi, nuôi dưỡng, thời cơ chưa đến'],
  [6,'Thiên Thủy Tụng','訟','111','010','Tranh chấp, kiện tụng, cần hòa giải'],
  [7,'Địa Thủy Sư','師','000','010','Quân đội, lãnh đạo, kỷ luật'],
  [8,'Thủy Địa Tỉ','比','010','000','Thân cận, liên kết, hợp tác'],
  [9,'Phong Thiên Tiểu Súc','小畜','110','111','Tích trữ nhỏ, nuôi dưỡng, chờ thời'],
  [10,'Thiên Trạch Lý','履','111','011','Đi cẩn thận, lễ nghi, hành xử đúng'],
  [11,'Địa Thiên Thái','泰','000','111','Thông suốt, hanh thông, thái bình'],
  [12,'Thiên Địa Bĩ','否','111','000','Bế tắc, trì trệ, không thông'],
  [13,'Thiên Hỏa Đồng Nhân','同人','111','101','Đồng lòng, hợp tác, cùng chí hướng'],
  [14,'Hỏa Thiên Đại Hữu','大有','101','111','Giàu có lớn, thịnh vượng, dồi dào'],
  [15,'Địa Sơn Khiêm','謙','000','100','Khiêm tốn, nhún nhường, đức tốt'],
  [16,'Lôi Địa Dự','豫','001','000','Vui vẻ, dự bị, thuận lợi'],
  [17,'Trạch Lôi Tùy','隨','011','001','Thuận theo, đi theo, thích ứng'],
  [18,'Sơn Phong Cổ','蠱','100','110','Sửa chữa sai lầm, cải cách'],
  [19,'Địa Trạch Lâm','臨','000','011','Đến gần, quản lý, cai quản'],
  [20,'Phong Địa Quan','觀','110','000','Quan sát, chiêm ngưỡng, suy xét'],
  [21,'Hỏa Lôi Phệ Hạp','噬嗑','101','001','Cắn xuyên, quyết đoán, xử lý trở ngại'],
  [22,'Sơn Hỏa Bí','賁','100','101','Trang sức, văn vẻ, hình thức'],
  [23,'Sơn Địa Bác','剝','100','000','Bóc lột, sụp đổ, suy tàn'],
  [24,'Địa Lôi Phục','復','000','001','Trở lại, phục hồi, khởi đầu mới'],
  [25,'Thiên Lôi Vô Vọng','无妄','111','001','Không vọng tưởng, chân thật, tự nhiên'],
  [26,'Sơn Thiên Đại Súc','大畜','100','111','Tích trữ lớn, nuôi dưỡng hiền tài'],
  [27,'Sơn Lôi Di','頤','100','001','Nuôi dưỡng, ăn uống, bảo dưỡng'],
  [28,'Trạch Phong Đại Quá','大過','011','110','Quá mức, gánh nặng, cần cẩn thận'],
  [29,'Thuần Khảm','坎','010','010','Nước, hiểm nguy, khó khăn chồng chất'],
  [30,'Thuần Ly','離','101','101','Lửa, sáng sủa, bám víu, phụ thuộc'],
  [31,'Trạch Sơn Hàm','咸','011','100','Cảm ứng, giao cảm, hôn nhân'],
  [32,'Lôi Phong Hằng','恆','001','110','Bền bỉ, lâu dài, kiên trì'],
  [33,'Thiên Sơn Độn','遯','111','100','Rút lui, ẩn náu, tránh né'],
  [34,'Lôi Thiên Đại Tráng','大壯','001','111','Mạnh mẽ lớn, hùng tráng, cần kiềm chế'],
  [35,'Hỏa Địa Tấn','晉','101','000','Tiến lên, thăng tiến, phát triển'],
  [36,'Địa Hỏa Minh Di','明夷','000','101','Ánh sáng bị thương, ẩn mình, thời kỳ tối'],
  [37,'Phong Hỏa Gia Nhân','家人','110','101','Gia đình, nội trợ, quản lý gia đạo'],
  [38,'Hỏa Trạch Khuê','睽','101','011','Đối lập, mâu thuẫn, bất hòa'],
  [39,'Thủy Sơn Kiển','蹇','010','100','Khó đi, trở ngại, chân bước khó'],
  [40,'Lôi Thủy Giải','解','001','010','Giải thoát, tháo gỡ, giải quyết'],
  [41,'Sơn Trạch Tổn','損','100','011','Giảm bớt, hy sinh, thiệt thòi để được'],
  [42,'Phong Lôi Ích','益','110','001','Tăng thêm, lợi ích, phát triển'],
  [43,'Trạch Thiên Quải','夬','011','111','Quyết đoán, cắt đứt, loại bỏ'],
  [44,'Thiên Phong Cấu','姤','111','110','Gặp gỡ bất ngờ, duyên số, cẩn thận'],
  [45,'Trạch Địa Tụy','萃','011','000','Tụ họp, quy tụ, đoàn kết'],
  [46,'Địa Phong Thăng','升','000','110','Đi lên, thăng tiến, phát triển dần'],
  [47,'Trạch Thủy Khốn','困','011','010','Khốn đốn, bế tắc, khó khăn'],
  [48,'Thủy Phong Tỉnh','井','010','110','Giếng nước, nguồn sống, bất biến'],
  [49,'Trạch Hỏa Cách','革','011','101','Cách mạng, thay đổi, đổi mới'],
  [50,'Hỏa Phong Đỉnh','鼎','101','110','Vạc nấu, nuôi hiền tài, canh tân'],
  [51,'Thuần Chấn','震','001','001','Sấm, chấn động, giật mình tỉnh ngộ'],
  [52,'Thuần Cấn','艮','100','100','Núi, dừng lại, tĩnh lặng, thiền định'],
  [53,'Phong Sơn Tiệm','漸','110','100','Tiến dần, từ từ, phát triển bền'],
  [54,'Lôi Trạch Quy Muội','歸妹','001','011','Gả em gái, hôn nhân, tùy thuộc'],
  [55,'Lôi Hỏa Phong','豐','001','101','Phong phú, dồi dào, cực thịnh'],
  [56,'Hỏa Sơn Lữ','旅','101','100','Lữ hành, du lịch, xa nhà'],
  [57,'Thuần Tốn','巽','110','110','Gió, thuận theo, nhẹ nhàng thấm dần'],
  [58,'Thuần Đoài','兌','011','011','Đầm, vui vẻ, hài lòng, giao tiếp'],
  [59,'Phong Thủy Hoán','渙','110','010','Phân tán, lan tỏa, giải tán'],
  [60,'Thủy Trạch Tiết','節','010','011','Tiết chế, hạn chế, điều độ'],
  [61,'Phong Trạch Trung Phu','中孚','110','011','Thành tín, trung thực, lòng tin'],
  [62,'Lôi Sơn Tiểu Quá','小過','001','100','Vượt quá nhỏ, cẩn thận, khiêm tốn'],
  [63,'Thủy Hỏa Ký Tế','既濟','010','101','Đã hoàn thành, cẩn thận giữ gìn'],
  [64,'Hỏa Thủy Vị Tế','未濟','101','010','Chưa hoàn thành, tiếp tục nỗ lực'],
];

// Lookup by trigram pair: upper+lower → hexagram index
export const HEXAGRAM_LOOKUP = {};
HEXAGRAMS.forEach((h, idx) => {
  HEXAGRAM_LOOKUP[h[3] + h[4]] = idx;
});

// Get hexagram from 6 lines (bottom to top, 0=yin, 1=yang)
export function getHexagram(lines) {
  const lower = lines.slice(0, 3).join('');
  const upper = lines.slice(3, 6).join('');
  const idx = HEXAGRAM_LOOKUP[upper + lower];
  return idx !== undefined ? HEXAGRAMS[idx] : null;
}

// Get biến quẻ (changed hexagram) from moving lines
export function getBienQue(lines, moving) {
  const newLines = lines.map((l, i) => moving.includes(i) ? (l === 1 ? 0 : 1) : l);
  return getHexagram(newLines);
}
