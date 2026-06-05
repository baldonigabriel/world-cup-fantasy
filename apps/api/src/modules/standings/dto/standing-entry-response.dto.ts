import { ApiProperty } from '@nestjs/swagger';
import { StandingEntryDto } from '@wcf/shared';

export class StandingEntryResponseDto implements StandingEntryDto {
  @ApiProperty() rank!: number;
  @ApiProperty() rosterId!: string;
  @ApiProperty() teamName!: string;
  @ApiProperty() username!: string;
  @ApiProperty({ description: 'Total points ×10' }) totalPoints!: number;
  @ApiProperty({ type: Object, description: 'roundId → points ×10' }) roundPoints!: Record<
    string,
    number
  >;
}
