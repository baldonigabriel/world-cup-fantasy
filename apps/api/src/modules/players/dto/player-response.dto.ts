import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Position } from '@wcf/shared';

export class CountryResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  code!: string;

  @ApiPropertyOptional()
  flagUrl!: string | null;
}

export class PlayerResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ enum: Position })
  position!: Position;

  @ApiPropertyOptional()
  photoUrl!: string | null;

  @ApiProperty({ type: CountryResponseDto })
  country!: CountryResponseDto;
}

export class ImportResultDto {
  @ApiProperty()
  imported!: number;

  @ApiProperty()
  skipped!: number;
}
