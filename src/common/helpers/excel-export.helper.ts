import { Response } from 'express';
import * as ExcelJS from 'exceljs';

export async function exportToExcel(
  res: Response,
  data: any[],
  fileName: string,
) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Sheet1');

  if (data.length === 0) {
    worksheet.addRow(['No data available']);
  } else {
    const columns = Object.keys(data[0]).map((key) => ({
      header: key,
      key,
      width: 25,
    }));

    worksheet.columns = columns;
    data.forEach((row) => worksheet.addRow(row));
  }

  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
  res.setHeader('Content-Disposition', `attachment; filename=${fileName}.xlsx`);

  await workbook.xlsx.write(res);
  res.end();
}
