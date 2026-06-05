import { ApiProperty } from '@nestjs/swagger';
import { RoundStage } from '@wcf/shared';

export class RoundResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: RoundStage }) stage!: RoundStage;
  @ApiProperty() opensAt!: string;
  @ApiProperty() lockAt!: string;
  @ApiProperty() locked!: boolean;
}
