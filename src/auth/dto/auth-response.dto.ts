import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

export class AuthResponseDto {
  @ApiProperty()
  accessToken: string;

  @ApiProperty()
  refreshToken: string;

  @ApiProperty({
    type: 'object',
    properties: {
      id: { type: 'string' },
      email: { type: 'string' },
      firstName: { type: 'string' },
      lastName: { type: 'string' },
      role: { enum: Object.values(UserRole) }
    }
  })
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: UserRole;
  };

  @ApiProperty({ example: '24h' })
  expiresIn: string;
}