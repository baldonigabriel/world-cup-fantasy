import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'johndoe ou johndoe@example.com', description: 'Username ou e-mail' })
  @IsString()
  identifier!: string;

  @ApiProperty({ example: 'strongpassword123' })
  @IsString()
  password!: string;
}
