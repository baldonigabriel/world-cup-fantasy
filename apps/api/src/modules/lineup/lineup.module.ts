import { Module } from '@nestjs/common';
import { LineupController } from './lineup.controller';
import { LineupService } from './lineup.service';

@Module({
  controllers: [LineupController],
  providers: [LineupService],
  exports: [LineupService],
})
export class LineupModule {}
